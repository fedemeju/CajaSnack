import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  BackupInfo,
  EstadoBackup,
  EstadoMail,
  EstadoNube,
  EstadoSeguridad,
  GuardarTurnoInput,
  LoginPayload,
  RegistroAuditoria,
  Rol,
  TipoTurno,
  Turno,
  Usuario
} from '../shared/types'

const api = {
  // ---- Arranque: base bloqueada / desbloqueo ----
  estaBloqueada: (): Promise<ApiResult<boolean>> => ipcRenderer.invoke('app:bloqueada'),

  desbloquear: (password: string): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('app:desbloquear', password),

  restaurarInicial: (password: string): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('app:restaurarInicial', password),

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

  reabrirTurno: (turnoId: number, password: string): Promise<ApiResult<Turno>> =>
    ipcRenderer.invoke('turno:reabrir', turnoId, password),

  listarTurnos: (
    actorId: number,
    desde?: string,
    hasta?: string
  ): Promise<ApiResult<Turno[]>> =>
    ipcRenderer.invoke('turno:listar', actorId, desde, hasta),

  listarAuditoria: (
    actorId: number,
    desde?: string,
    hasta?: string
  ): Promise<ApiResult<RegistroAuditoria[]>> =>
    ipcRenderer.invoke('auditoria:listar', actorId, desde, hasta),

  // ---- Datos / backups ----
  listarBackups: (actorId: number): Promise<ApiResult<BackupInfo[]>> =>
    ipcRenderer.invoke('datos:listarBackups', actorId),

  abrirCarpetaBackups: (actorId: number): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('datos:abrirCarpetaBackups', actorId),

  exportarCopia: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:exportarCopia', actorId),

  exportarLegible: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:exportarLegible', actorId),

  marcarCopiaHecha: (actorId: number): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('datos:marcarCopiaHecha', actorId),

  restaurarBackup: (actorId: number, nombre: string): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('datos:restaurarInterno', actorId, nombre),

  restaurarArchivo: (actorId: number): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('datos:restaurarArchivo', actorId),

  estadoBackup: (actorId: number): Promise<ApiResult<EstadoBackup>> =>
    ipcRenderer.invoke('datos:estado', actorId),

  borrarTurnos: (actorId: number, password: string): Promise<ApiResult<number>> =>
    ipcRenderer.invoke('datos:borrarTurnos', actorId, password),

  // ---- Seguridad: recuperación + respaldo externo ----
  estadoSeguridad: (actorId: number): Promise<ApiResult<EstadoSeguridad>> =>
    ipcRenderer.invoke('seguridad:estado', actorId),

  configurarRecovery: (actorId: number, password: string): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('seguridad:configurarRecovery', actorId, password),

  verificarRecovery: (actorId: number, password: string): Promise<ApiResult<boolean>> =>
    ipcRenderer.invoke('seguridad:verificarRecovery', actorId, password),

  sugerenciasRespaldo: (actorId: number): Promise<ApiResult<string[]>> =>
    ipcRenderer.invoke('seguridad:sugerenciasRespaldo', actorId),

  elegirRespaldo: (actorId: number): Promise<ApiResult<EstadoSeguridad | null>> =>
    ipcRenderer.invoke('seguridad:elegirRespaldo', actorId),

  usarRespaldo: (actorId: number, dir: string): Promise<ApiResult<EstadoSeguridad>> =>
    ipcRenderer.invoke('seguridad:usarRespaldo', actorId, dir),

  quitarRespaldo: (actorId: number): Promise<ApiResult<EstadoSeguridad>> =>
    ipcRenderer.invoke('seguridad:quitarRespaldo', actorId),

  respaldarAhora: (actorId: number): Promise<ApiResult<EstadoSeguridad>> =>
    ipcRenderer.invoke('seguridad:respaldarAhora', actorId),

  flushPendientes: (actorId: number): Promise<ApiResult<EstadoSeguridad>> =>
    ipcRenderer.invoke('seguridad:flushPendientes', actorId),

  restaurarConPassword: (actorId: number, password: string): Promise<ApiResult<string | null>> =>
    ipcRenderer.invoke('seguridad:restaurarConPassword', actorId, password),

  // ---- Copia en la nube (Supabase) ----
  estadoNube: (actorId: number): Promise<ApiResult<EstadoNube>> =>
    ipcRenderer.invoke('nube:estado', actorId),

  configurarNube: (
    actorId: number,
    url: string,
    anonKey: string,
    email: string,
    password: string
  ): Promise<ApiResult<EstadoNube>> =>
    ipcRenderer.invoke('nube:configurar', actorId, url, anonKey, email, password),

  quitarNube: (actorId: number): Promise<ApiResult<EstadoNube>> =>
    ipcRenderer.invoke('nube:quitar', actorId),

  sincronizarNube: (actorId: number): Promise<ApiResult<EstadoNube>> =>
    ipcRenderer.invoke('nube:sincronizar', actorId),

  restaurarNube: (actorId: number, password: string): Promise<ApiResult<boolean>> =>
    ipcRenderer.invoke('nube:restaurar', actorId, password),

  /** Escribe un PDF temporal y lo abre en el visor del sistema. */
  abrirPDF: (nombre: string, bytes: Uint8Array): Promise<ApiResult<string>> =>
    ipcRenderer.invoke('pdf:abrir', nombre, bytes),

  // ---- Envío del cierre por email ----
  estadoMail: (actorId: number): Promise<ApiResult<EstadoMail>> =>
    ipcRenderer.invoke('mail:estado', actorId),

  configurarMail: (
    actorId: number,
    user: string,
    appPassword: string,
    destino: string
  ): Promise<ApiResult<EstadoMail>> =>
    ipcRenderer.invoke('mail:configurar', actorId, user, appPassword, destino),

  quitarMail: (actorId: number): Promise<ApiResult<EstadoMail>> =>
    ipcRenderer.invoke('mail:quitar', actorId),

  enviarCierreMail: (
    bytes: Uint8Array,
    meta: { fecha: string; tipo: 'manana' | 'noche'; tipoLabel: string; cajero: string }
  ): Promise<ApiResult<null>> => ipcRenderer.invoke('mail:enviarCierre', bytes, meta),

  /** Avisa al proceso principal si hay un guardado en vuelo (para advertir al cerrar). */
  notificarGuardando: (valor: boolean): void => ipcRenderer.send('app:guardando', valor)
}

export type CajaApi = typeof api

contextBridge.exposeInMainWorld('api', api)
