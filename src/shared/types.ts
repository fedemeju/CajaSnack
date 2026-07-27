export type Rol = 'manana' | 'tarde' | 'admin'

export interface Usuario {
  id: number
  usuario: string
  nombre: string
  rol: Rol
}

export type TipoTurno = 'manana' | 'noche'
export type EstadoTurno = 'abierto' | 'cerrado'

export type MedioPago = 'efectivo' | 'mercadoPago'

/** Renglón de gasto (proveedores / otros) del turno mañana. */
export interface LineaGasto {
  concepto: string
  persona: string
  monto: number
  /** Solo proveedores: cómo se pagó. Los pagados en efectivo se cuentan como entregado. */
  medioPago?: MedioPago
}

/** Renglón de facturación de mesa (turno noche). */
export interface LineaMesa {
  detalle: string
  monto: number
}

/** Renglón de rubro con cantidades (cumples, eventos, etc). */
export interface LineaRubro {
  concepto: string
  paquetes: number
  cantidad: number
  monto: number
  /** Si ya está facturado (en mesas), no se suma al total para no duplicar. */
  facturado?: boolean
}

export interface TurnoMananaData {
  // Ingresos (recuadro de arriba)
  cajaBase: number
  /** Desglose de la caja base en varios ingresos (suma = cajaBase). */
  cajaBaseItems?: LineaMesa[]
  facturadoMostradorTelefono: number
  mesa49: number
  recibidoMozo: number
  /** Ingresos por cumples y eventos del turno mañana (uno o varios). */
  cumplesEventos?: LineaMesa[]
  poolUnidades: number
  poolPrecio: number
  // Egresos
  proveedores: LineaGasto[]
  otros: LineaGasto[]
  // Entregado / cierre (recuadro de abajo)
  cajaDejadaSiguienteTurno: number
  efectivoRetirado: number
  tarjetasRetiradas: number
  mercadoPago: LineaMesa[]
  /** Factura Lincoln (uno o varios cobros). Suma al Total Entregado, igual que Mercado Pago. */
  facturaLincoln?: LineaMesa[]
  pedidosYa: number
  /** Nombre de la persona que cerró la caja (se pide al cerrar el turno). */
  cerradoPor?: string
}

export interface AperturaNoche {
  cajaBase: number
  mozos: LineaMesa[]
  notas: string
}

export interface TurnoNocheData {
  apertura: AperturaNoche
  // Facturación
  mesasFacturadas: LineaMesa[]
  mesasSinFacturar: LineaMesa[]
  // Entregado (arriba a la derecha)
  poolUnidades: number
  poolPrecio: number
  tarjetas: number
  efectivoEnCaja: number
  efectivoEnSobres: number
  pedidoYa: number
  facturasProveedores: LineaMesa[]
  instructoras: number
  mercadoPago: number
  vales: LineaMesa[]
  transferencias: LineaMesa[]
  entregadoExtra: LineaMesa[]
  // Rubros del total de abajo
  cumples: LineaRubro[]
  eventos: LineaRubro[]
  totalBowling: number
  /** Nombre de la persona que cerró la caja (se pide al cerrar el turno). */
  cerradoPor?: string
}

/** Un evento en el historial de firma de la apertura del turno noche. */
export interface FirmaEvento {
  at: string // ISO datetime
  firmante: string // nombre de quien firmó/modificó
  accion: 'firma' | 'modificacion'
}

export interface Turno {
  id: number
  fecha: string
  tipo: TipoTurno
  usuarioId: number
  usuarioNombre: string
  estado: EstadoTurno
  data: TurnoMananaData | TurnoNocheData
  aprobadoPor: number | null
  aprobadoPorNombre: string | null
  aprobadoAt: string | null
  firmaLog: FirmaEvento[]
  creadoAt: string
  actualizadoAt: string
}

/** Un registro de la bitácora de actividad (auditoría). */
export interface RegistroAuditoria {
  id: number
  at: string // ISO datetime
  usuarioId: number | null
  usuarioNombre: string
  accion: string
  detalle: string
}

// ---- Payloads IPC ----

export interface LoginPayload {
  usuario: string
  password: string
}

export interface GuardarTurnoInput {
  id?: number
  fecha: string
  tipo: TipoTurno
  usuarioId: number
  data: TurnoMananaData | TurnoNocheData
  cerrar: boolean
}

export interface BackupInfo {
  /** Nombre del archivo dentro de la carpeta de backups. */
  nombre: string
  /** Tamaño en bytes. */
  tamano: number
  /** Fecha de la copia (ISO). */
  fecha: string
}

export interface EstadoBackup {
  /** Fecha de la última exportación a archivo (ISO), o null si nunca se hizo. */
  ultima: string | null
  /** Días transcurridos desde la última exportación, o null si nunca se hizo. */
  dias: number | null
}

/** Estado del protocolo de seguridad/respaldo de los datos. */
export interface EstadoSeguridad {
  /** Hay una contraseña de recuperación configurada (clave envuelta por password). */
  recuperacionConfigurada: boolean
  /** Carpeta de respaldo externo (pendrive / Drive / OneDrive), o null. */
  respaldoDir: string | null
  /** Fecha (ISO) del último respaldo externo exitoso, o null. */
  respaldoUltimo: string | null
  /** Hay copias pendientes de subir al respaldo externo (se reintentan solas). */
  respaldoPendiente: number
}

/** Estado del envío del cierre por email. */
export interface EstadoMail {
  configurado: boolean
  /** Cuenta Gmail desde la que se envía, o null. */
  remitente: string | null
  /** Email destino del cierre, o null. */
  destino: string | null
  /** Cierres pendientes de enviar (se reintentan al cerrar el próximo turno). */
  pendientes: number
}

/** Estado de la copia en la nube (Supabase Storage), siempre cifrada. */
export interface EstadoNube {
  configurada: boolean
  email: string | null
  /** Fecha (ISO) del último envío exitoso a la nube, o null. */
  ultimo: string | null
  /** Copias pendientes de subir (se reintentan solas). */
  pendientes: number
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Resultado del envío del cierre por email, para confirmar al cerrar el turno. */
export type MailEnvioResultado = 'enviado' | 'pendiente' | 'sin-config'

/** Precio por defecto del pool (unidad). Se usa al abrir turnos nuevos. */
export const POOL_PRECIO_DEFECTO = 7000

export function turnoMananaVacio(): TurnoMananaData {
  return {
    cajaBase: 0,
    cajaBaseItems: [{ detalle: '', monto: 0 }],
    facturadoMostradorTelefono: 0,
    mesa49: 0,
    recibidoMozo: 0,
    cumplesEventos: [{ detalle: '', monto: 0 }],
    poolUnidades: 0,
    poolPrecio: POOL_PRECIO_DEFECTO,
    proveedores: [],
    otros: [],
    cajaDejadaSiguienteTurno: 0,
    efectivoRetirado: 0,
    tarjetasRetiradas: 0,
    mercadoPago: [],
    facturaLincoln: [],
    pedidosYa: 0
  }
}

export function turnoNocheVacio(): TurnoNocheData {
  return {
    apertura: {
      cajaBase: 0,
      mozos: [10, 13].map((n) => ({ detalle: String(n), monto: 0 })),
      notas: ''
    },
    mesasFacturadas: [10].map((n) => ({ detalle: String(n), monto: 0 })),
    mesasSinFacturar: [49, 105].map((n) => ({ detalle: String(n), monto: 0 })),
    poolUnidades: 0,
    poolPrecio: POOL_PRECIO_DEFECTO,
    tarjetas: 0,
    efectivoEnCaja: 0,
    efectivoEnSobres: 0,
    pedidoYa: 0,
    facturasProveedores: [],
    instructoras: 0,
    mercadoPago: 0,
    vales: [],
    transferencias: [],
    entregadoExtra: [],
    cumples: [],
    eventos: [],
    totalBowling: 0
  }
}
