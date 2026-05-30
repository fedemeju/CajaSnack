import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import type { ApiResult, GuardarTurnoInput, LoginPayload, Rol, TipoTurno } from '../shared/types'
import {
  firmarApertura,
  borrarTurnos,
  cambiarPassword,
  crearUsuario,
  estadoBackup,
  exportarDatosCSV,
  guardarTurno,
  listarTurnos,
  listarUsuarios,
  login,
  marcarExportacion,
  modificarFirma,
  obtenerPorFecha,
  obtenerTurno,
  reabrirTurno,
  requireAdmin,
  turnoAbiertoPendiente
} from './repo'
import {
  backupsPath,
  exportarCopia,
  listarBackups,
  restaurarBackupInterno,
  restaurarDesdeArchivo
} from './db'

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

  handle('turno:reabrir', (turnoId) => reabrirTurno(turnoId as number))

  handle('turno:listar', (actorId, desde, hasta) =>
    listarTurnos(actorId as number, desde as string | undefined, hasta as string | undefined)
  )

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

  handle('datos:borrarTurnos', (actorId, password) =>
    borrarTurnos(actorId as number, password as string)
  )

  handle('datos:restaurarInterno', (actorId, nombre) => {
    requireAdmin(actorId as number)
    restaurarBackupInterno(nombre as string)
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
    restaurarDesdeArchivo(filePaths[0])
    return filePaths[0]
  })
}
