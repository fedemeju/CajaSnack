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
}

export interface TurnoMananaData {
  // Ingresos (recuadro de arriba)
  cajaBase: number
  facturadoMostradorTelefono: number
  mesa49: number
  recibidoMozo: number
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
  pedidosYa: number
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

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function turnoMananaVacio(): TurnoMananaData {
  return {
    cajaBase: 0,
    facturadoMostradorTelefono: 0,
    mesa49: 0,
    recibidoMozo: 0,
    poolUnidades: 0,
    poolPrecio: 6000,
    proveedores: [],
    otros: [],
    cajaDejadaSiguienteTurno: 0,
    efectivoRetirado: 0,
    tarjetasRetiradas: 0,
    mercadoPago: [],
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
    poolPrecio: 6000,
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
