import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import type { ApiResult, GuardarTurnoInput, LoginPayload, Rol, TipoTurno } from '../shared/types'
import {
  firmarApertura,
  borrarTurnos,
  cambiarPassword,
  crearUsuario,
  estadoBackup,
  exportarDatosCSV,
  getUsuario,
  guardarTurno,
  listarAuditoria,
  listarTurnos,
  listarUsuarios,
  login,
  marcarExportacion,
  modificarFirma,
  obtenerPorFecha,
  obtenerTurno,
  reabrirTurno,
  registrarEvento,
  requireAdmin,
  turnoAbiertoPendiente
} from './repo'
import {
  backupsPath,
  configurarRecovery,
  desbloquearConPassword,
  estaBloqueada,
  estadoSeguridad,
  exportarCopia,
  flushPendientesRespaldo,
  listarBackups,
  respaldarAhora,
  restaurarBackupInterno,
  restaurarConPassword,
  restaurarDesdeArchivo,
  setRespaldoDir,
  verificarRecovery
} from './db'
import { configurarNube, descargarUltimaA, estadoNube, flushNube, quitarNube } from './cloudSync'
import { configurarMail, enviarCierre, estadoMail, quitarMail, type CierreMeta } from './mailer'

function handle<T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<ApiResult<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10)
}

export function registerIpc(): void {
  // ---- Arranque: base bloqueada / desbloqueo (sin login, la base no abrió) ----

  handle('app:bloqueada', () => estaBloqueada())

  handle('app:desbloquear', (password) => {
    desbloquearConPassword(password as string)
    return null
  })

  handle('app:restaurarInicial', async (password) => {
    if (!estaBloqueada()) throw new Error('La base no está bloqueada.')
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Restaurar copia con contraseña de recuperación',
      properties: ['openFile'],
      filters: [{ name: 'Copia CajaSnack', extensions: ['enc', 'db'] }]
    })
    if (canceled || !filePaths[0]) return null
    restaurarConPassword(filePaths[0], password as string)
    return filePaths[0]
  })

  handle('auth:login', (payload) => {
    const { usuario, password } = payload as LoginPayload
    const u = login(usuario, password)
    if (!u) throw new Error('Usuario o contraseña incorrectos.')
    return u
  })

  handle('auth:cambiarPassword', (actorId, targetId, nueva) =>
    cambiarPassword(actorId as number, targetId as number, nueva as string)
  )

  handle('usuarios:listar', (actorId) => listarUsuarios(actorId as number))

  handle('usuarios:crear', (actorId, usuario, nombre, rol, password) =>
    crearUsuario(
      actorId as number,
      usuario as string,
      nombre as string,
      rol as Rol,
      password as string
    )
  )

  handle('turno:obtenerPorFecha', (fecha, tipo) =>
    obtenerPorFecha(fecha as string, tipo as TipoTurno)
  )

  handle('turno:abiertoPendiente', (tipo) => turnoAbiertoPendiente(tipo as TipoTurno))

  handle('turno:obtener', (id) => obtenerTurno(id as number))

  handle('turno:guardar', (input) => guardarTurno(input as GuardarTurnoInput))

  handle('turno:firmarApertura', (turnoId, password) =>
    firmarApertura(turnoId as number, password as string)
  )

  handle('turno:modificarFirma', (turnoId, password) =>
    modificarFirma(turnoId as number, password as string)
  )

  handle('turno:reabrir', (turnoId, password) =>
    reabrirTurno(turnoId as number, password as string)
  )

  handle('turno:listar', (actorId, desde, hasta) =>
    listarTurnos(actorId as number, desde as string | undefined, hasta as string | undefined)
  )

  handle('auditoria:listar', (actorId, desde, hasta) =>
    listarAuditoria(actorId as number, desde as string | undefined, hasta as string | undefined)
  )

  // Escribe el PDF generado por el renderer en un archivo temporal y lo ABRE
  // en el visor de PDF del sistema (para verlo sin tener que buscarlo en disco).
  handle('pdf:abrir', async (nombre, bytes) => {
    const dir = join(tmpdir(), 'cajasnack-pdf')
    mkdirSync(dir, { recursive: true })
    const safe = String(nombre).replace(/[^a-zA-Z0-9._-]/g, '_')
    const file = join(dir, safe)
    writeFileSync(file, Buffer.from(bytes as Uint8Array))
    const err = await shell.openPath(file)
    if (err) throw new Error(err)
    return file
  })

  // Lee el portapapeles (para traer el total de la extensión "Calculadora MP").
  handle('portapapeles:leer', () => clipboard.readText())

  // ---- Datos / backups (solo admin) ----

  handle('datos:listarBackups', (actorId) => {
    requireAdmin(actorId as number)
    return listarBackups()
  })

  handle('datos:estado', (actorId) => estadoBackup(actorId as number))

  handle('datos:abrirCarpetaBackups', async (actorId) => {
    requireAdmin(actorId as number)
    await shell.openPath(backupsPath())
    return null
  })

  handle('datos:exportarCopia', async (actorId) => {
    requireAdmin(actorId as number)
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Exportar copia de seguridad',
      defaultPath: `CajaSnack-backup-${fechaArchivo()}.db.enc`,
      filters: [{ name: 'Copia cifrada CajaSnack', extensions: ['enc'] }]
    })
    if (canceled || !filePath) return null
    exportarCopia(filePath)
    marcarExportacion()
    return filePath
  })

  handle('datos:exportarLegible', async (actorId) => {
    requireAdmin(actorId as number)
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Exportar datos para Excel',
      defaultPath: `CajaSnack-datos-${fechaArchivo()}.csv`,
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, exportarDatosCSV(), 'utf8')
    marcarExportacion()
    return filePath
  })

  // El admin afirma que ya tiene una copia afuera (hecha a mano / en otro momento):
  // registramos la fecha para que el recordatorio deje de aparecer.
  handle('datos:marcarCopiaHecha', (actorId) => {
    requireAdmin(actorId as number)
    marcarExportacion()
    return null
  })

  handle('datos:borrarTurnos', (actorId, password) =>
    borrarTurnos(actorId as number, password as string)
  )

  handle('datos:restaurarInterno', (actorId, nombre) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    restaurarBackupInterno(nombre as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Restauró copia de seguridad', String(nombre))
    return null
  })

  handle('datos:restaurarArchivo', async (actorId) => {
    requireAdmin(actorId as number)
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Restaurar desde archivo',
      properties: ['openFile'],
      filters: [{ name: 'Copia CajaSnack', extensions: ['enc', 'db'] }]
    })
    if (canceled || !filePaths[0]) return null
    const admin = getUsuario(actorId as number)
    restaurarDesdeArchivo(filePaths[0])
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Restauró copia desde archivo', filePaths[0])
    return filePaths[0]
  })

  // ---- Seguridad: recuperación por contraseña + respaldo externo ----

  handle('seguridad:estado', (actorId) => {
    requireAdmin(actorId as number)
    return estadoSeguridad()
  })

  handle('seguridad:configurarRecovery', (actorId, password) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    configurarRecovery(password as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Configuró contraseña de recuperación')
    return null
  })

  handle('seguridad:verificarRecovery', (actorId, password) => {
    requireAdmin(actorId as number)
    return verificarRecovery(password as string)
  })

  // Sugiere carpetas de Drive/OneDrive ya presentes en la PC para el respaldo.
  handle('seguridad:sugerenciasRespaldo', (actorId) => {
    requireAdmin(actorId as number)
    const home = homedir()
    const candidatos = [
      process.env.OneDrive,
      process.env.OneDriveConsumer,
      process.env.OneDriveCommercial,
      join(home, 'OneDrive'),
      join(home, 'Google Drive'),
      join(home, 'GoogleDrive'),
      join(home, 'My Drive'),
      'G:\\My Drive',
      'G:\\Mi unidad'
    ].filter((p): p is string => !!p)
    const vistos = new Set<string>()
    const out: string[] = []
    for (const p of candidatos) {
      if (!vistos.has(p) && existsSync(p)) {
        vistos.add(p)
        out.push(p)
      }
    }
    return out
  })

  handle('seguridad:elegirRespaldo', async (actorId) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Elegí la carpeta de respaldo (pendrive o carpeta de Drive/OneDrive)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths[0]) return null
    setRespaldoDir(filePaths[0])
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Configuró carpeta de respaldo', filePaths[0])
    return estadoSeguridad()
  })

  handle('seguridad:usarRespaldo', (actorId, dir) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    setRespaldoDir(dir as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Configuró carpeta de respaldo', String(dir))
    return estadoSeguridad()
  })

  handle('seguridad:quitarRespaldo', (actorId) => {
    requireAdmin(actorId as number)
    setRespaldoDir(null)
    return estadoSeguridad()
  })

  handle('seguridad:respaldarAhora', (actorId) => {
    requireAdmin(actorId as number)
    return respaldarAhora()
  })

  handle('seguridad:flushPendientes', (actorId) => {
    requireAdmin(actorId as number)
    flushPendientesRespaldo()
    return estadoSeguridad()
  })

  handle('seguridad:restaurarConPassword', async (actorId, password) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Restaurar copia con contraseña de recuperación',
      properties: ['openFile'],
      filters: [{ name: 'Copia CajaSnack', extensions: ['enc', 'db'] }]
    })
    if (canceled || !filePaths[0]) return null
    restaurarConPassword(filePaths[0], password as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Restauró copia con contraseña', filePaths[0])
    return filePaths[0]
  })

  // ---- Copia en la nube (Supabase Storage, siempre cifrada) ----

  handle('nube:estado', (actorId) => {
    requireAdmin(actorId as number)
    return estadoNube()
  })

  handle('nube:configurar', async (actorId, url, anonKey, email, password) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    const est = await configurarNube(url as string, anonKey as string, email as string, password as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Configuró copia en la nube', String(email))
    return est
  })

  handle('nube:quitar', (actorId) => {
    requireAdmin(actorId as number)
    return quitarNube()
  })

  handle('nube:sincronizar', async (actorId) => {
    requireAdmin(actorId as number)
    return flushNube()
  })

  // ---- Envío del cierre por email (Gmail) ----

  handle('mail:estado', (actorId) => {
    requireAdmin(actorId as number)
    return estadoMail()
  })

  handle('mail:configurar', async (actorId, user, appPassword, destino) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    const est = await configurarMail(user as string, appPassword as string, destino as string)
    registrarEvento(actorId as number, admin?.nombre ?? 'Admin', 'Configuró envío de cierre por email', String(destino))
    return est
  })

  handle('mail:quitar', (actorId) => {
    requireAdmin(actorId as number)
    return quitarMail()
  })

  // Lo dispara el turno (mañana/noche) al cerrar; no requiere admin. Best-effort.
  handle('mail:enviarCierre', async (bytes, meta) => {
    return await enviarCierre(bytes as Uint8Array, meta as CierreMeta)
  })

  // Recuperación manual: baja la última copia de la nube y la restaura con la
  // contraseña de recuperación. Reemplaza la base local (deja un resguardo antes).
  handle('nube:restaurar', async (actorId, password) => {
    requireAdmin(actorId as number)
    const admin = getUsuario(actorId as number)
    const dir = join(tmpdir(), 'cajasnack-restaurar-nube')
    mkdirSync(dir, { recursive: true })
    const dbPath = await descargarUltimaA(dir)
    restaurarConPassword(dbPath, password as string)
    registrarEvento(
      actorId as number,
      admin?.nombre ?? 'Admin',
      'Restauró copia desde la nube (Supabase)'
    )
    return true
  })
}
