import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  BackupInfo,
  EstadoBackup,
  GuardarTurnoInput,
  LoginPayload,
  Rol,
  TipoTurno,
  Turno,
  Usuario
} from '../shared/types'

const api = {
  login: (payload: LoginPayload): Promise<ApiResult<Usuario>> =>
    ipcRenderer.invoke('auth:login', payload),

  cambiarPassword: (
    actorId: number,
    targetId: number,
    nueva: string
  ): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('auth:cambiarPassword', actorId, targetId, nueva),

  listarUsuarios: (actorId: number): Promise<ApiResult<Usuario[]>> =>
    ipcRenderer.invoke('usuarios:listar', actorId),

  crearUsuario: (
    actorId: number,
    usuario: string,
    nombre: string,
    rol: Rol,
    password: string
  ): Promise<ApiResult<Usuario>> =>
    ipcRenderer.invoke('usuarios:crear', actorId, usuario, nombre, rol, password),

  obtenerTurnoPorFecha: (
    fecha: string,
    tipo: TipoTurno
  ): Promise<ApiResult<Turno | null>> =>
    ipcRenderer.invoke('turno:obtenerPorFecha', fecha, tipo),

  obtenerTurno: (id: number): Promise<ApiResult<Turno | null>> =>
    ipcRenderer.invoke('turno:obtener', id),

  turnoAbiertoPendiente: (tipo: TipoTurno): Promise<ApiResult<Turno | null>> =>
    ipcRenderer.invoke('turno:abiertoPendiente', tipo),

  guardarTurno: (input: GuardarTurnoInput): Promise<ApiResult<Turno>> =>
    ipcRenderer.invoke('turno:guardar', input),

  firmarApertura: (turnoId: number, password: string): Promise<ApiResult<Turno>> =>
    ipcRenderer.invoke('turno:firmarApertura', turnoId, password),

  modificarFirma: (turnoId: number, password: string): Promise<ApiResult<Turno>> =>
    ipcRenderer.invoke('turno:modificarFirma', turnoId, password),

  reabrirTurno: (turnoId: number): Promise<ApiResult<Turno>> =>
    ipcRenderer.invoke('turno:reabrir', turnoId),

  listarTurnos: (
    actorId: number,
    desde?: string,
    hasta?: string
  ): Promise<ApiResult<Turno[]>> =>
    ipcRenderer.invoke('turno:listar', actorId, desde, hasta),

  // ---- Datos / backups ----
  listarBackups: (actorId: number): Promise<ApiResult<BackupInfo[]>> =>
    ipcRenderer.invoke('datos:listarBackups', actorId),

  abrirCarpetaBackups: (actorId: number): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('datos:abrirCarpetaBackups', actorId),

  exportarCopia: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:exportarCopia', actorId),

  exportarLegible: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:exportarLegible', actorId),

  restaurarBackup: (actorId: number, nombre: string): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('datos:restaurarInterno', actorId, nombre),

  restaurarArchivo: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:restaurarArchivo', actorId),

  estadoBackup: (actorId: number): Promise<ApiResult<EstadoBackup>> =>
    ipcRenderer.invoke('datos:estado', actorId),

  borrarTurnos: (actorId: number, password: string): Promise<ApiResult<number>> =>
    ipcRenderer.invoke('datos:borrarTurnos', actorId, password),

  /** Avisa al proceso principal si hay un guardado en vuelo (para advertir al cerrar). */
  notificarGuardando: (valor: boolean): void => ipcRenderer.send('app:guardando', valor)
}

export type CajaApi = typeof api

contextBridge.exposeInMainWorld('api', api)
