import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type { BackupInfo, EstadoSeguridad } from '../shared/types'
import {
  decrypt,
  desenvolverClaveConPassword,
  encrypt,
  envolverClaveConPassword,
  getDbKey
} from './crypto'

/** Cuántas copias conservar en la carpeta de backups (las más viejas se borran). */
const MAX_BACKUPS = 60

let SQL: SqlJsStatic
let db: Database
let key: Buffer
/** true si la base existe pero no se pudo descifrar con la clave de esta PC. */
let bloqueada = false

function dbFilePath(): string {
  return join(app.getPath('userData'), 'caja.db.enc')
}

function backupsDir(): string {
  const dir = join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// ---- Recuperación por contraseña ----

function recoveryKeyPath(): string {
  return join(app.getPath('userData'), 'caja.recovery.key')
}

/** ¿Hay una contraseña de recuperación configurada? */
export function recuperacionConfigurada(): boolean {
  return existsSync(recoveryKeyPath())
}

/** Configura/actualiza la contraseña de recuperación (envuelve la clave del DB). */
export function configurarRecovery(password: string): void {
  if (!password || password.length < 6) {
    throw new Error('La contraseña de recuperación debe tener al menos 6 caracteres.')
  }
  writeFileSync(recoveryKeyPath(), envolverClaveConPassword(key, password))
  empujarRecoveryARespaldo()
}

/** Verifica que la contraseña de recuperación sea correcta. */
export function verificarRecovery(password: string): boolean {
  if (!existsSync(recoveryKeyPath())) return false
  try {
    const k = desenvolverClaveConPassword(readFileSync(recoveryKeyPath()), password)
    return k.equals(key)
  } catch {
    return false
  }
}

// ---- Respaldo externo (segunda carpeta: pendrive / Drive / OneDrive) ----

interface RespaldoCfg {
  dir: string | null
  ultimo: string | null
  pendientes: string[]
}

function respaldoCfgPath(): string {
  return join(app.getPath('userData'), 'respaldo.json')
}

function leerRespaldoCfg(): RespaldoCfg {
  try {
    const c = JSON.parse(readFileSync(respaldoCfgPath(), 'utf8'))
    return {
      dir: typeof c.dir === 'string' ? c.dir : null,
      ultimo: typeof c.ultimo === 'string' ? c.ultimo : null,
      pendientes: Array.isArray(c.pendientes) ? c.pendientes.map(String) : []
    }
  } catch {
    return { dir: null, ultimo: null, pendientes: [] }
  }
}

function escribirRespaldoCfg(c: RespaldoCfg): void {
  writeFileSync(respaldoCfgPath(), JSON.stringify(c, null, 2), 'utf8')
}

/** Subcarpeta dentro del destino externo donde se guardan las copias. */
function respaldoDestDir(dir: string): string {
  return join(dir, 'CajaSnack-backups')
}

/** Copia la llave de recuperación al destino externo (para que sea autosuficiente). */
function empujarRecoveryARespaldo(): void {
  const cfg = leerRespaldoCfg()
  if (!cfg.dir || !existsSync(cfg.dir) || !existsSync(recoveryKeyPath())) return
  try {
    const dest = respaldoDestDir(cfg.dir)
    mkdirSync(dest, { recursive: true })
    copyFileSync(recoveryKeyPath(), join(dest, 'caja.recovery.key'))
  } catch {
    /* si el destino no está disponible, se reintenta en el próximo respaldo */
  }
}

/**
 * Intenta copiar un archivo de copia al destino externo. Si el destino no está
 * disponible (pendrive desenchufado, carpeta de Drive ausente), lo deja pendiente
 * para reintentar más tarde. Nunca lanza: el respaldo externo es best-effort.
 */
function copiarARespaldo(srcFullPath: string): void {
  const cfg = leerRespaldoCfg()
  if (!cfg.dir) return
  const name = basename(srcFullPath)
  try {
    if (!existsSync(cfg.dir)) throw new Error('destino no disponible')
    const dest = respaldoDestDir(cfg.dir)
    mkdirSync(dest, { recursive: true })
    copyFileSync(srcFullPath, join(dest, name))
    if (existsSync(recoveryKeyPath())) {
      copyFileSync(recoveryKeyPath(), join(dest, 'caja.recovery.key'))
    }
    cfg.pendientes = cfg.pendientes.filter((p) => p !== name)
    cfg.ultimo = new Date().toISOString()
    escribirRespaldoCfg(cfg)
  } catch {
    if (!cfg.pendientes.includes(name)) cfg.pendientes.push(name)
    escribirRespaldoCfg(cfg)
  }
}

/**
 * Reintenta subir las copias pendientes al destino externo. Se llama al arrancar
 * y cada vez que se hace una copia, así "sigue intentando hasta que pueda subirlo".
 */
export function flushPendientesRespaldo(): void {
  const cfg = leerRespaldoCfg()
  if (!cfg.dir || !cfg.pendientes.length || !existsSync(cfg.dir)) return
  let dest: string
  try {
    dest = respaldoDestDir(cfg.dir)
    mkdirSync(dest, { recursive: true })
  } catch {
    return
  }
  const restantes: string[] = []
  for (const name of cfg.pendientes) {
    const src = join(backupsDir(), name)
    try {
      if (existsSync(src)) copyFileSync(src, join(dest, name))
    } catch {
      restantes.push(name)
    }
  }
  try {
    if (existsSync(recoveryKeyPath())) copyFileSync(recoveryKeyPath(), join(dest, 'caja.recovery.key'))
  } catch {
    /* no crítico */
  }
  cfg.pendientes = restantes
  if (restantes.length === 0) cfg.ultimo = new Date().toISOString()
  escribirRespaldoCfg(cfg)
}

/** Define (o quita con null) la carpeta de respaldo externo y empuja una copia ya. */
export function setRespaldoDir(dir: string | null): void {
  const cfg = leerRespaldoCfg()
  if (dir && !existsSync(dir)) throw new Error('La carpeta elegida no existe o no está disponible.')
  cfg.dir = dir
  escribirRespaldoCfg(cfg)
  if (dir) {
    const file = dbFilePath()
    if (existsSync(file)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const snap = join(backupsDir(), `caja_${ts}_respaldo-inicial.db.enc`)
      try {
        copyFileSync(file, snap)
        copiarARespaldo(snap)
      } catch {
        /* best-effort */
      }
    }
    empujarRecoveryARespaldo()
  }
}

/** Fuerza un respaldo ahora: crea una copia y la empuja al destino externo. */
export function respaldarAhora(): EstadoSeguridad {
  const file = dbFilePath()
  if (existsSync(file)) {
    persist()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const snap = join(backupsDir(), `caja_${ts}_manual.db.enc`)
    copyFileSync(file, snap)
    rotarBackups()
    copiarARespaldo(snap)
  }
  flushPendientesRespaldo()
  return estadoSeguridad()
}

export function estadoSeguridad(): EstadoSeguridad {
  const cfg = leerRespaldoCfg()
  return {
    recuperacionConfigurada: existsSync(recoveryKeyPath()),
    respaldoDir: cfg.dir,
    respaldoUltimo: cfg.ultimo,
    respaldoPendiente: cfg.pendientes.length
  }
}

/**
 * Restaura una copia usando la CONTRASEÑA de recuperación (sirve aunque la copia
 * venga de otra PC / otro candado del sistema). Busca el archivo caja.recovery.key
 * junto a la copia elegida; si no, usa el de esta PC. Tras restaurar, re-cifra con
 * el candado local y refresca la llave de recuperación con la misma contraseña.
 */
export function restaurarConPassword(ruta: string, password: string): void {
  if (!existsSync(ruta)) throw new Error('El archivo seleccionado no existe.')
  const dir = dirname(ruta)
  const recPath = existsSync(join(dir, 'caja.recovery.key'))
    ? join(dir, 'caja.recovery.key')
    : existsSync(recoveryKeyPath())
      ? recoveryKeyPath()
      : null
  if (!recPath) {
    throw new Error(
      'No se encontró el archivo de recuperación (caja.recovery.key) junto a la copia ni en esta PC.'
    )
  }
  let dbKey: Buffer
  try {
    dbKey = desenvolverClaveConPassword(readFileSync(recPath), password)
  } catch {
    throw new Error('Contraseña de recuperación incorrecta o archivo de recuperación dañado.')
  }
  let restored: Buffer
  try {
    restored = decrypt(readFileSync(ruta), dbKey)
  } catch {
    throw new Error('No se pudo descifrar la copia con esa contraseña de recuperación.')
  }
  let candidata: Database
  try {
    candidata = new SQL.Database(new Uint8Array(restored))
    candidata.run('SELECT 1 FROM turnos LIMIT 1')
    candidata.run('SELECT 1 FROM usuarios LIMIT 1')
  } catch {
    throw new Error('La copia no parece una base de CajaSnack válida.')
  }
  if (!bloqueada) backup('antes_de_restaurar')
  db.close()
  db = candidata
  db.run(SCHEMA)
  migrarColumnas()
  bloqueada = false
  persist() // re-cifra con el candado local de ESTA PC
  try {
    writeFileSync(recoveryKeyPath(), envolverClaveConPassword(key, password))
  } catch {
    /* la recuperación se puede reconfigurar luego */
  }
}

function wasmPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'sql-wasm.wasm')
    : join(app.getAppPath(), 'resources', 'sql-wasm.wasm')
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS turnos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  usuario_id INTEGER NOT NULL,
  estado TEXT NOT NULL,
  data TEXT NOT NULL,
  aprobado_por INTEGER,
  aprobado_at TEXT,
  creado_at TEXT NOT NULL,
  actualizado_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  usuario_id INTEGER,
  usuario_nombre TEXT NOT NULL,
  accion TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT ''
);
`

export async function initDb(): Promise<void> {
  key = getDbKey()
  backupsDir() // garantiza que la carpeta de copias exista desde el arranque
  const wasmBuf = readFileSync(wasmPath())
  const wasmBinary = wasmBuf.buffer.slice(
    wasmBuf.byteOffset,
    wasmBuf.byteOffset + wasmBuf.byteLength
  )
  SQL = await initSqlJs({ wasmBinary })

  const file = dbFilePath()
  if (existsSync(file)) {
    try {
      const decrypted = decrypt(readFileSync(file), key)
      db = new SQL.Database(new Uint8Array(decrypted))
    } catch {
      // La base existe pero no se puede descifrar con la clave de esta PC
      // (cambió el candado del SO / es de otra PC). NO la tocamos: queda
      // "bloqueada" y el usuario la recupera con la contraseña de recuperación.
      bloqueada = true
      db = new SQL.Database()
      db.run(SCHEMA) // esquema solo en memoria; NUNCA se persiste sobre el archivo bloqueado
      return
    }
  } else {
    db = new SQL.Database()
  }
  db.run(SCHEMA)
  migrarColumnas()
  persist()
}

/** ¿La base quedó bloqueada (no se pudo descifrar al arrancar)? */
export function estaBloqueada(): boolean {
  return bloqueada
}

/**
 * Desbloquea en el mismo lugar una base que no abrió con la clave del SO,
 * usando la contraseña de recuperación local (caja.recovery.key). Re-cifra con
 * la clave local actual para que vuelva a abrir normalmente.
 */
export function desbloquearConPassword(password: string): void {
  if (!bloqueada) return
  const recPath = recoveryKeyPath()
  if (!existsSync(recPath)) {
    throw new Error(
      'Esta PC no tiene contraseña de recuperación guardada. Usá "Restaurar desde una copia" y elegí un archivo .enc junto a su caja.recovery.key.'
    )
  }
  let dbKey: Buffer
  try {
    dbKey = desenvolverClaveConPassword(readFileSync(recPath), password)
  } catch {
    throw new Error('Contraseña de recuperación incorrecta.')
  }
  let restored: Buffer
  try {
    restored = decrypt(readFileSync(dbFilePath()), dbKey)
  } catch {
    throw new Error('La contraseña no corresponde a estos datos (la recuperación no coincide con la base).')
  }
  let candidata: Database
  try {
    candidata = new SQL.Database(new Uint8Array(restored))
    candidata.run('SELECT 1 FROM usuarios LIMIT 1')
  } catch {
    throw new Error('La base recuperada no es válida.')
  }
  db.close()
  db = candidata
  db.run(SCHEMA)
  migrarColumnas()
  bloqueada = false
  persist() // re-cifra con la clave local de ESTA PC
  try {
    writeFileSync(recPath, envolverClaveConPassword(key, password))
  } catch {
    /* la recuperación se puede reconfigurar luego */
  }
}

/** Agrega columnas nuevas a bases ya existentes (CREATE TABLE IF NOT EXISTS no las altera). */
function migrarColumnas(): void {
  const cols = db.exec("PRAGMA table_info('turnos')")
  const nombres = cols.length ? cols[0].values.map((v) => String(v[1])) : []
  if (!nombres.includes('firma_log')) {
    db.run('ALTER TABLE turnos ADD COLUMN firma_log TEXT')
  }
}

/** Guarda la base cifrada en disco de forma atómica (temp + rename). */
export function persist(): void {
  const data = Buffer.from(db.export())
  const blob = encrypt(data, key)
  const file = dbFilePath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, blob)
  renameSync(tmp, file)
}

/** Copia la base cifrada actual a la carpeta de backups con marca de tiempo. */
export function backup(etiqueta = ''): void {
  const file = dbFilePath()
  if (!existsSync(file)) return
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const suf = etiqueta ? `_${etiqueta}` : ''
  const dest = join(backupsDir(), `caja_${ts}${suf}.db.enc`)
  copyFileSync(file, dest)
  rotarBackups()
  copiarARespaldo(dest)
}

/**
 * Crea una copia del día si todavía no existe. Es barato (solo chequea si el
 * archivo de hoy ya está), así que se puede llamar en cada guardado para
 * garantizar al menos un backup diario sin inundar la carpeta.
 */
export function backupDiario(): void {
  const file = dbFilePath()
  if (!existsSync(file)) return
  const hoy = new Date().toLocaleDateString('en-CA')
  const dest = join(backupsDir(), `caja_diario_${hoy}.db.enc`)
  if (existsSync(dest)) return
  copyFileSync(file, dest)
  rotarBackups()
  copiarARespaldo(dest)
}

/** Borra las copias más viejas dejando solo las MAX_BACKUPS más recientes. */
function rotarBackups(): void {
  const dir = backupsDir()
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('caja_') && f.endsWith('.db.enc'))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const { f } of files.slice(MAX_BACKUPS)) {
    try {
      unlinkSync(join(dir, f))
    } catch {
      /* si no se puede borrar uno, seguimos */
    }
  }
}

/** Lista las copias guardadas (más recientes primero). */
export function listarBackups(): BackupInfo[] {
  const dir = backupsDir()
  return readdirSync(dir)
    .filter((f) => f.startsWith('caja_') && f.endsWith('.db.enc'))
    .map((f) => {
      const st = statSync(join(dir, f))
      return { nombre: f, tamano: st.size, fecha: st.mtime.toISOString() }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Ruta de la carpeta de backups (para abrirla en el explorador). */
export function backupsPath(): string {
  return backupsDir()
}

/** Copia la base cifrada actual a la ruta destino elegida por el usuario. */
export function exportarCopia(destPath: string): void {
  persist()
  copyFileSync(dbFilePath(), destPath)
}

/**
 * Restaura la base desde un archivo de copia. El archivo debe poder
 * descifrarse con la clave de ESTA PC y ser una base válida de CajaSnack.
 * Antes de pisar la base actual, deja un resguardo de seguridad.
 */
export function restaurarDesdeArchivo(ruta: string): void {
  if (!existsSync(ruta)) throw new Error('El archivo seleccionado no existe.')
  let restored: Buffer
  try {
    restored = decrypt(readFileSync(ruta), key)
  } catch {
    throw new Error('No se pudo abrir la copia (puede ser de otra PC/usuario de Windows, o estar dañada).')
  }
  let candidata: Database
  try {
    candidata = new SQL.Database(new Uint8Array(restored))
    candidata.run('SELECT 1 FROM turnos LIMIT 1')
    candidata.run('SELECT 1 FROM usuarios LIMIT 1')
  } catch {
    throw new Error('La copia no parece una base de CajaSnack válida.')
  }
  backup('antes_de_restaurar')
  db.close()
  db = candidata
  // La copia puede ser anterior a tablas/columnas nuevas: aseguramos el esquema.
  db.run(SCHEMA)
  migrarColumnas()
  persist()
}

/** Restaura una copia interna (de la carpeta de backups) por nombre de archivo. */
export function restaurarBackupInterno(nombre: string): void {
  if (nombre.includes('/') || nombre.includes('\\') || nombre.includes('..')) {
    throw new Error('Nombre de copia inválido.')
  }
  restaurarDesdeArchivo(join(backupsDir(), nombre))
}

type Row = Record<string, unknown>

export function all(sql: string, params: unknown[] = []): Row[] {
  const stmt = db.prepare(sql)
  stmt.bind(params as never)
  const rows: Row[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function get(sql: string, params: unknown[] = []): Row | undefined {
  return all(sql, params)[0]
}

export function run(sql: string, params: unknown[] = []): void {
  db.run(sql, params as never)
}

export function lastInsertId(): number {
  const r = get('SELECT last_insert_rowid() AS id')
  return Number(r?.id ?? 0)
}
