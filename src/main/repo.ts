import bcrypt from 'bcryptjs'
import { all, backup, backupDiario, get, lastInsertId, persist, run } from './db'
import type {
  EstadoBackup,
  FirmaEvento,
  GuardarTurnoInput,
  Rol,
  TipoTurno,
  Turno,
  TurnoMananaData,
  TurnoNocheData,
  Usuario
} from '../shared/types'
import { calcularManana, calcularNoche, movimientosTurno } from '../shared/calc'

function nowIso(): string {
  return new Date().toISOString()
}

const CLAVE_ULTIMA_EXPORT = 'ultimaExportacion'

function getConfig(clave: string): string | null {
  const r = get('SELECT valor FROM config WHERE clave = ?', [clave])
  return r ? String(r.valor) : null
}

function setConfig(clave: string, valor: string): void {
  run(
    'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    [clave, valor]
  )
  persist()
}

/** Registra que el admin acaba de exportar una copia a archivo. */
export function marcarExportacion(): void {
  setConfig(CLAVE_ULTIMA_EXPORT, nowIso())
}

/** Días desde la última exportación a archivo, para el recordatorio. */
export function estadoBackup(actorId: number): EstadoBackup {
  requireAdmin(actorId)
  const ultima = getConfig(CLAVE_ULTIMA_EXPORT)
  if (!ultima) return { ultima: null, dias: null }
  const dias = Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000)
  return { ultima, dias }
}

function rowToUsuario(r: Record<string, unknown>): Usuario {
  return {
    id: Number(r.id),
    usuario: String(r.usuario),
    nombre: String(r.nombre),
    rol: String(r.rol) as Rol
  }
}

export function login(usuario: string, password: string): Usuario | null {
  const r = get('SELECT * FROM usuarios WHERE usuario = ?', [usuario.trim().toLowerCase()])
  if (!r) return null
  if (!bcrypt.compareSync(password, String(r.password_hash))) return null
  return rowToUsuario(r)
}

export function getUsuario(id: number): Usuario | null {
  const r = get('SELECT * FROM usuarios WHERE id = ?', [id])
  return r ? rowToUsuario(r) : null
}

export function requireAdmin(actorId: number): void {
  const u = getUsuario(actorId)
  if (!u || u.rol !== 'admin') throw new Error('No autorizado: requiere admin.')
}

export function listarUsuarios(actorId: number): Usuario[] {
  requireAdmin(actorId)
  return all('SELECT * FROM usuarios ORDER BY rol').map(rowToUsuario)
}

const ROLES_VALIDOS: Rol[] = ['manana', 'tarde', 'admin']

export function crearUsuario(
  actorId: number,
  usuario: string,
  nombre: string,
  rol: Rol,
  password: string
): Usuario {
  requireAdmin(actorId)
  const user = usuario.trim().toLowerCase()
  const nom = nombre.trim()
  if (!user) throw new Error('El nombre de usuario es obligatorio.')
  if (!/^[a-z0-9._-]+$/.test(user)) {
    throw new Error('El usuario solo puede tener letras, números, punto, guion y guion bajo.')
  }
  if (!nom) throw new Error('El nombre es obligatorio.')
  if (!ROLES_VALIDOS.includes(rol)) throw new Error('Rol inválido.')
  if (password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.')
  if (get('SELECT id FROM usuarios WHERE usuario = ?', [user])) {
    throw new Error('Ya existe un usuario con ese nombre.')
  }
  run('INSERT INTO usuarios (usuario, nombre, rol, password_hash) VALUES (?, ?, ?, ?)', [
    user,
    nom,
    rol,
    bcrypt.hashSync(password, 10)
  ])
  persist()
  return getUsuario(lastInsertId())!
}

export function cambiarPassword(actorId: number, targetId: number, nueva: string): void {
  const actor = getUsuario(actorId)
  if (!actor) throw new Error('No autorizado.')
  if (actor.rol !== 'admin' && actor.id !== targetId) {
    throw new Error('Solo el admin puede cambiar la contraseña de otros usuarios.')
  }
  if (nueva.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.')
  run('UPDATE usuarios SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(nueva, 10), targetId])
  persist()
}

function parseFirmaLog(raw: unknown): FirmaEvento[] {
  if (raw == null) return []
  try {
    const arr = JSON.parse(String(raw))
    return Array.isArray(arr) ? (arr as FirmaEvento[]) : []
  } catch {
    return []
  }
}

function rowToTurno(r: Record<string, unknown>): Turno {
  return {
    id: Number(r.id),
    fecha: String(r.fecha),
    tipo: String(r.tipo) as TipoTurno,
    usuarioId: Number(r.usuario_id),
    usuarioNombre: r.usuario_nombre ? String(r.usuario_nombre) : '',
    estado: String(r.estado) as Turno['estado'],
    data: JSON.parse(String(r.data)),
    aprobadoPor: r.aprobado_por != null ? Number(r.aprobado_por) : null,
    aprobadoPorNombre: r.aprobador_nombre ? String(r.aprobador_nombre) : null,
    aprobadoAt: r.aprobado_at != null ? String(r.aprobado_at) : null,
    firmaLog: parseFirmaLog(r.firma_log),
    creadoAt: String(r.creado_at),
    actualizadoAt: String(r.actualizado_at)
  }
}

const SELECT_TURNO = `
SELECT t.*, u.nombre AS usuario_nombre, a.nombre AS aprobador_nombre
FROM turnos t
LEFT JOIN usuarios u ON u.id = t.usuario_id
LEFT JOIN usuarios a ON a.id = t.aprobado_por
`

export function obtenerTurno(id: number): Turno | null {
  const r = get(`${SELECT_TURNO} WHERE t.id = ?`, [id])
  return r ? rowToTurno(r) : null
}

/** Devuelve el turno (abierto o cerrado) para una fecha y tipo, o null. */
export function obtenerPorFecha(fecha: string, tipo: TipoTurno): Turno | null {
  const r = get(`${SELECT_TURNO} WHERE t.fecha = ? AND t.tipo = ?`, [fecha, tipo])
  return r ? rowToTurno(r) : null
}

/**
 * Devuelve el turno abierto MÁS ANTIGUO de un tipo (el que quedó sin cerrar),
 * o null si no hay ninguno pendiente. Sirve para obligar a cerrar ese antes
 * de abrir uno nuevo.
 */
export function turnoAbiertoPendiente(tipo: TipoTurno): Turno | null {
  const r = get(
    `${SELECT_TURNO} WHERE t.tipo = ? AND t.estado = 'abierto' ORDER BY t.fecha ASC LIMIT 1`,
    [tipo]
  )
  return r ? rowToTurno(r) : null
}

export function guardarTurno(input: GuardarTurnoInput): Turno {
  const ahora = nowIso()
  const estado = input.cerrar ? 'cerrado' : 'abierto'
  const dataJson = JSON.stringify(input.data)

  let id = input.id
  if (id) {
    const actual = obtenerTurno(id)
    if (!actual) throw new Error('El turno no existe.')
    if (actual.estado === 'cerrado') throw new Error('El turno ya está cerrado y no se puede modificar.')
    run('UPDATE turnos SET data = ?, estado = ?, actualizado_at = ? WHERE id = ?', [
      dataJson,
      estado,
      ahora,
      id
    ])
  } else {
    const existente = obtenerPorFecha(input.fecha, input.tipo)
    if (existente) throw new Error('Ya existe un turno cargado para esa fecha.')
    run(
      'INSERT INTO turnos (fecha, tipo, usuario_id, estado, data, creado_at, actualizado_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.fecha, input.tipo, input.usuarioId, estado, dataJson, ahora, ahora]
    )
    id = lastInsertId()
  }

  persist()
  backupDiario()
  if (input.cerrar) backup(`turno${id}`)
  return obtenerTurno(id)!
}

/** Reabre un turno cerrado para corregirlo (p. ej. si se cerró sin querer). La firma se conserva. */
export function reabrirTurno(turnoId: number): Turno {
  const turno = obtenerTurno(turnoId)
  if (!turno) throw new Error('El turno no existe.')
  if (turno.estado !== 'cerrado') return turno
  run('UPDATE turnos SET estado = ?, actualizado_at = ? WHERE id = ?', ['abierto', nowIso(), turnoId])
  persist()
  return obtenerTurno(turnoId)!
}

/** Valida la contraseña del turno mañana y devuelve el firmante, o lanza error. */
function validarFirmanteManana(password: string): Usuario {
  const candidatos = all("SELECT * FROM usuarios WHERE rol = 'manana'")
  for (const r of candidatos) {
    if (bcrypt.compareSync(password, String(r.password_hash))) {
      return rowToUsuario(r)
    }
  }
  throw new Error('Contraseña del turno mañana incorrecta.')
}

/**
 * El turno mañana valida la apertura del turno noche y la firma ingresando
 * SUS propias credenciales (aunque en pantalla esté logueado el turno tarde).
 */
export function firmarApertura(turnoId: number, password: string): Turno {
  const firmante = validarFirmanteManana(password)
  const turno = obtenerTurno(turnoId)
  if (!turno) throw new Error('El turno no existe.')
  if (turno.tipo !== 'noche') throw new Error('Solo se firma la apertura del turno noche.')
  const ahora = nowIso()
  const log: FirmaEvento[] = [
    ...turno.firmaLog,
    { at: ahora, firmante: firmante.nombre, accion: 'firma' }
  ]
  run(
    'UPDATE turnos SET aprobado_por = ?, aprobado_at = ?, firma_log = ?, actualizado_at = ? WHERE id = ?',
    [firmante.id, ahora, JSON.stringify(log), ahora, turnoId]
  )
  persist()
  return obtenerTurno(turnoId)!
}

/**
 * Si el turno mañana se confundió al firmar, puede volver a habilitar la apertura
 * para corregirla. Se registra la modificación (con horario) para avisar al admin
 * y se quita la firma; luego deberá firmar de nuevo.
 */
export function modificarFirma(turnoId: number, password: string): Turno {
  const firmante = validarFirmanteManana(password)
  const turno = obtenerTurno(turnoId)
  if (!turno) throw new Error('El turno no existe.')
  if (turno.tipo !== 'noche') throw new Error('Solo se modifica la firma del turno noche.')
  if (!turno.aprobadoPor) throw new Error('La apertura todavía no está firmada.')
  const ahora = nowIso()
  const log: FirmaEvento[] = [
    ...turno.firmaLog,
    { at: ahora, firmante: firmante.nombre, accion: 'modificacion' }
  ]
  run(
    'UPDATE turnos SET aprobado_por = NULL, aprobado_at = NULL, firma_log = ?, actualizado_at = ? WHERE id = ?',
    [JSON.stringify(log), ahora, turnoId]
  )
  persist()
  return obtenerTurno(turnoId)!
}

/**
 * Borra TODOS los turnos cargados. Es una acción peligrosa y solo la puede
 * ejecutar el admin reingresando su contraseña. Antes de borrar deja un
 * resguardo de toda la base por las dudas. Devuelve cuántos turnos se borraron.
 */
export function borrarTurnos(actorId: number, password: string): number {
  const actor = getUsuario(actorId)
  if (!actor || actor.rol !== 'admin') throw new Error('No autorizado: requiere admin.')
  const r = get('SELECT password_hash FROM usuarios WHERE id = ?', [actorId])
  if (!r || !bcrypt.compareSync(password, String(r.password_hash))) {
    throw new Error('Contraseña incorrecta.')
  }
  const cuantos = all('SELECT id FROM turnos').length
  if (cuantos > 0) backup('antes_de_borrar_turnos')
  run('DELETE FROM turnos')
  persist()
  return cuantos
}

export function listarTurnos(actorId: number, desde?: string, hasta?: string): Turno[] {
  requireAdmin(actorId)
  let sql = SELECT_TURNO
  const params: unknown[] = []
  const conds: string[] = []
  if (desde) {
    conds.push('t.fecha >= ?')
    params.push(desde)
  }
  if (hasta) {
    conds.push('t.fecha <= ?')
    params.push(hasta)
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
  sql += ' ORDER BY t.fecha DESC, t.tipo'
  return all(sql, params).map(rowToTurno)
}

/**
 * Genera un CSV legible (abre en Excel) con todos los turnos y sus totales.
 * No depende de la clave de cifrado: es texto plano recuperable siempre.
 * Usa ";" como separador y BOM UTF-8 para que Excel en español muestre bien
 * los acentos y respete las columnas.
 */
export function exportarDatosCSV(): string {
  const turnos = all(`${SELECT_TURNO} ORDER BY t.fecha, t.tipo`).map(rowToTurno)
  const headers = [
    'Fecha',
    'Turno',
    'Cajero',
    'Estado',
    'Total',
    'Cuadra',
    'Diferencia',
    'Mercado Pago',
    'Tarjetas',
    'Pedidos Ya',
    'Efectivo',
    'Proveedores',
    'Otros gastos'
  ]
  const filas = turnos.map((t) => {
    const m = movimientosTurno(t)
    let total = 0
    let cuadra = false
    let dif = 0
    if (t.tipo === 'manana') {
      const c = calcularManana(t.data as TurnoMananaData)
      total = c.totalArriba
      cuadra = c.cuadra
      dif = c.diferencia
    } else {
      const c = calcularNoche(t.data as TurnoNocheData)
      total = c.totalRestaurante
      cuadra = c.cuadra
      dif = c.diferencia
    }
    return [
      t.fecha,
      t.tipo === 'manana' ? 'Mañana' : 'Noche',
      t.usuarioNombre,
      t.estado,
      total,
      cuadra ? 'Sí' : 'No',
      dif,
      m.mercadoPago,
      m.tarjetas,
      m.pedidosYa,
      m.efectivo,
      m.proveedores,
      m.otrosGastos
    ]
  })
  const esc = (v: unknown): string => {
    const s = String(v ?? '')
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [headers, ...filas].map((r) => r.map(esc).join(';'))
  return '﻿' + lineas.join('\r\n')
}
