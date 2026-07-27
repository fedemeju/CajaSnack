import type {
  LineaGasto,
  LineaMesa,
  LineaRubro,
  Turno,
  TurnoMananaData,
  TurnoNocheData
} from './types'

export function sumaGastos(lineas: LineaGasto[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce((acc, l) => acc + (l.monto || 0), 0)
}

/** Suma de gastos pagados en efectivo (medioPago indefinido = efectivo). */
export function sumaGastosEfectivo(lineas: LineaGasto[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce(
    (acc, l) => acc + ((l.medioPago ?? 'efectivo') === 'efectivo' ? l.monto || 0 : 0),
    0
  )
}

export function sumaMesas(lineas: LineaMesa[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce((acc, l) => acc + (l.monto || 0), 0)
}

/** Suma los renglones de rubro que NO están marcados como ya facturados. */
export function sumaRubro(lineas: LineaRubro[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce((acc, l) => acc + (l.facturado ? 0 : l.monto || 0), 0)
}

export interface CuadreManana {
  totalArriba: number // ingresos: Total + Caja
  totalAbajo: number // entregado
  proveedoresEfectivo: number // proveedores pagados en efectivo (entran en entregado)
  otrosEfectivo: number // otros gastos pagados en efectivo (entran en entregado)
  totalGastos: number
  diferencia: number // totalArriba - totalAbajo
  cuadra: boolean
}

export function calcularManana(d: TurnoMananaData): CuadreManana {
  const totalPool = (d.poolUnidades || 0) * (d.poolPrecio || 0)
  // La caja base puede ser un solo número (turnos viejos) o varios ingresos que
  // se suman (cajaBaseItems). Si hay ítems, mandan ellos.
  const cajaBase =
    d.cajaBaseItems && d.cajaBaseItems.length ? sumaMesas(d.cajaBaseItems) : d.cajaBase || 0
  const cumplesEventos = sumaMesas(d.cumplesEventos ?? [])
  // El Pool se RESTA del total de la mañana (no es un ingreso, sale de la caja).
  const totalArriba =
    cajaBase +
    (d.facturadoMostradorTelefono || 0) +
    (d.mesa49 || 0) +
    (d.recibidoMozo || 0) +
    cumplesEventos -
    totalPool
  const proveedoresEfectivo = sumaGastosEfectivo(d.proveedores)
  const otrosEfectivo = sumaGastosEfectivo(d.otros)
  const totalAbajo =
    (d.cajaDejadaSiguienteTurno || 0) +
    (d.efectivoRetirado || 0) +
    (d.tarjetasRetiradas || 0) +
    sumaMesas(d.mercadoPago) +
    sumaMesas(d.facturaLincoln ?? []) +
    (d.pedidosYa || 0) +
    proveedoresEfectivo +
    otrosEfectivo
  const totalGastos = sumaGastos(d.proveedores) + sumaGastos(d.otros)
  const diferencia = totalArriba - totalAbajo
  return {
    totalArriba,
    totalAbajo,
    proveedoresEfectivo,
    otrosEfectivo,
    totalGastos,
    diferencia,
    cuadra: diferencia === 0
  }
}

export interface CuadreNoche {
  totalFacturado: number
  totalSinFacturar: number
  totalRestaurante: number // cajaBase + facturado + sin facturar
  totalEntregado: number // arriba a la derecha
  totalCumples: number // cumples + señas
  totalEventos: number // eventos + señas
  totalRubros: number // total de abajo (restaurante + bowling + cumples + eventos)
  aporteCajaGeneral: number // efectivo en sobres + efectivo en caja - caja base
  diferencia: number // totalEntregado - totalRubros
  cuadra: boolean
}

export function calcularNoche(d: TurnoNocheData): CuadreNoche {
  const totalFacturado = sumaMesas(d.mesasFacturadas)
  const totalSinFacturar = sumaMesas(d.mesasSinFacturar)
  const cajaBase = d.apertura?.cajaBase || 0
  const totalRestaurante = cajaBase + totalFacturado + totalSinFacturar

  const totalPool = (d.poolUnidades || 0) * (d.poolPrecio || 0)
  const totalEntregado =
    totalPool +
    (d.tarjetas || 0) +
    (d.efectivoEnCaja || 0) +
    (d.efectivoEnSobres || 0) +
    (d.pedidoYa || 0) +
    sumaMesas(d.facturasProveedores) +
    (d.instructoras || 0) +
    (d.mercadoPago || 0) +
    sumaMesas(d.vales) +
    sumaMesas(d.transferencias) +
    sumaMesas(d.entregadoExtra)

  // sumaRubro ya excluye las líneas marcadas como "ya facturadas" (cada renglón
  // tiene su propio check), así que no se duplican con lo facturado en mesas.
  const totalCumples = sumaRubro(d.cumples)
  const totalEventos = sumaRubro(d.eventos)

  const totalRubros = totalRestaurante + (d.totalBowling || 0) + totalCumples + totalEventos

  // Aporte a la caja general = efectivo dejado (sobres + caja) menos la caja base.
  const aporteCajaGeneral = (d.efectivoEnSobres || 0) + (d.efectivoEnCaja || 0) - cajaBase

  const diferencia = totalEntregado - totalRubros
  return {
    totalFacturado,
    totalSinFacturar,
    totalRestaurante,
    totalEntregado,
    totalCumples,
    totalEventos,
    totalRubros,
    aporteCajaGeneral,
    diferencia,
    cuadra: diferencia === 0
  }
}

/** Resultado del cuadre de un turno, independiente del tipo. */
export interface CuadreTurno {
  total: number
  cuadra: boolean
  /** > 0 falta en lo entregado, < 0 sobra. */
  diferencia: number
}

/** Cuadre normalizado de un turno (mañana o noche), para reportes. */
export function cuadreDeTurno(t: Turno): CuadreTurno {
  if (t.tipo === 'manana') {
    const c = calcularManana(t.data as TurnoMananaData)
    return { total: c.totalArriba, cuadra: c.cuadra, diferencia: c.diferencia }
  }
  const c = calcularNoche(t.data as TurnoNocheData)
  // En noche, c.diferencia = entregado - rubros: >0 significa que SOBRÓ.
  // Normalizamos al convenio de CuadreTurno (>0 falta, <0 sobra) invirtiendo el signo.
  // El "total" muestra el total real de la noche (restaurante + bowling + cumples + eventos),
  // que es justamente totalRubros. NO afecta el cuadre (cuadra/diferencia no cambian).
  return { total: c.totalRubros, cuadra: c.cuadra, diferencia: -c.diferencia }
}

/** Monto de Bowling de un turno (0 si es turno mañana). */
export function bowlingDeTurno(t: Turno): number {
  if (t.tipo !== 'noche') return 0
  return (t.data as TurnoNocheData).totalBowling || 0
}

/** Desglose de la facturación de un turno por rubro (todo 0 si es mañana). */
export interface RubrosTurno {
  restaurante: number
  bowling: number
  cumples: number
  eventos: number
  pedidoYa: number
  pool: number
  poolUnidades: number
}

export function rubrosDeTurno(t: Turno): RubrosTurno {
  if (t.tipo !== 'noche')
    return { restaurante: 0, bowling: 0, cumples: 0, eventos: 0, pedidoYa: 0, pool: 0, poolUnidades: 0 }
  const d = t.data as TurnoNocheData
  const c = calcularNoche(d)
  const fullCumples = (d.cumples ?? []).reduce((a, l) => a + (l.monto || 0), 0)
  const fullEventos = (d.eventos ?? []).reduce((a, l) => a + (l.monto || 0), 0)
  // Los cumples/eventos FACTURADOS, Pedidos Ya y el Pool están dentro de lo
  // facturado en mesas; los re-atribuimos a su rubro para mostrar el ingreso real
  // de cada uno (el total no cambia).
  const factCumples = fullCumples - c.totalCumples
  const factEventos = fullEventos - c.totalEventos
  const pedidoYa = d.pedidoYa || 0
  const pool = (d.poolUnidades || 0) * (d.poolPrecio || 0)
  // "Restaurante" = facturado + sin facturar, SIN la caja base (fondo inicial, no
  // es ingreso) y SIN lo que ya se contó en cumples/eventos/Pedidos Ya/Pool.
  const restauranteIngresos =
    c.totalFacturado + c.totalSinFacturar - factCumples - factEventos - pedidoYa - pool
  return {
    restaurante: restauranteIngresos,
    bowling: d.totalBowling || 0,
    cumples: fullCumples,
    eventos: fullEventos,
    pedidoYa,
    pool,
    poolUnidades: d.poolUnidades || 0
  }
}

/**
 * Ingreso BRUTO de cumples y eventos de un turno, **incluyendo los facturados**
 * (que no suman al cuadre del día, pero sí son ingresos a registrar para el Admin).
 */
export interface AgasajosTurno {
  cumples: number
  eventos: number
  cumplesCant: number
  eventosCant: number
}

export function agasajosDeTurno(t: Turno): AgasajosTurno {
  if (t.tipo !== 'noche') return { cumples: 0, eventos: 0, cumplesCant: 0, eventosCant: 0 }
  const d = t.data as TurnoNocheData
  const sum = (arr: LineaRubro[] | undefined): number =>
    (arr ?? []).reduce((a, l) => a + (l.monto || 0), 0)
  const cnt = (arr: LineaRubro[] | undefined): number =>
    (arr ?? []).filter((l) => (l.monto || 0) > 0 || (l.concepto || '').trim()).length
  return {
    cumples: sum(d.cumples),
    eventos: sum(d.eventos),
    cumplesCant: cnt(d.cumples),
    eventosCant: cnt(d.eventos)
  }
}

export function sumarAgasajos(turnos: Turno[]): AgasajosTurno {
  return turnos.reduce(
    (acc, t) => {
      const a = agasajosDeTurno(t)
      return {
        cumples: acc.cumples + a.cumples,
        eventos: acc.eventos + a.eventos,
        cumplesCant: acc.cumplesCant + a.cumplesCant,
        eventosCant: acc.eventosCant + a.eventosCant
      }
    },
    { cumples: 0, eventos: 0, cumplesCant: 0, eventosCant: 0 }
  )
}

/** Suma de rubros de una lista de turnos. */
export function sumarRubros(turnos: Turno[]): RubrosTurno {
  return turnos.reduce(
    (acc, t) => {
      const r = rubrosDeTurno(t)
      return {
        restaurante: acc.restaurante + r.restaurante,
        bowling: acc.bowling + r.bowling,
        cumples: acc.cumples + r.cumples,
        eventos: acc.eventos + r.eventos,
        pedidoYa: acc.pedidoYa + r.pedidoYa,
        pool: acc.pool + r.pool,
        poolUnidades: acc.poolUnidades + r.poolUnidades
      }
    },
    { restaurante: 0, bowling: 0, cumples: 0, eventos: 0, pedidoYa: 0, pool: 0, poolUnidades: 0 }
  )
}

/** Movimientos de un turno desglosados por categoría, para sumar en reportes. */
export interface MovimientosTurno {
  mercadoPago: number
  tarjetas: number
  pedidosYa: number
  efectivo: number
  transferencias: number
  proveedores: number
  otrosGastos: number
}

const MOVIMIENTOS_VACIO: MovimientosTurno = {
  mercadoPago: 0,
  tarjetas: 0,
  pedidosYa: 0,
  efectivo: 0,
  transferencias: 0,
  proveedores: 0,
  otrosGastos: 0
}

export function movimientosTurno(t: Turno): MovimientosTurno {
  if (t.tipo === 'manana') {
    const d = t.data as TurnoMananaData
    return {
      mercadoPago: sumaMesas(d.mercadoPago),
      tarjetas: d.tarjetasRetiradas || 0,
      pedidosYa: d.pedidosYa || 0,
      efectivo: d.efectivoRetirado || 0,
      transferencias: 0,
      proveedores: sumaGastos(d.proveedores),
      otrosGastos: sumaGastos(d.otros)
    }
  }
  const d = t.data as TurnoNocheData
  return {
    mercadoPago: d.mercadoPago || 0,
    tarjetas: d.tarjetas || 0,
    pedidosYa: d.pedidoYa || 0,
    efectivo: (d.efectivoEnCaja || 0) + (d.efectivoEnSobres || 0),
    transferencias: sumaMesas(d.transferencias),
    proveedores: sumaMesas(d.facturasProveedores),
    otrosGastos: 0
  }
}

/** Entradas/salidas/balance derivados de los movimientos (criterio: por medio de cobro). */
export function entradasSalidas(m: MovimientosTurno): {
  entradas: number
  salidas: number
  balance: number
} {
  const entradas = m.mercadoPago + m.tarjetas + m.pedidosYa + m.efectivo + m.transferencias
  const salidas = m.proveedores + m.otrosGastos
  return { entradas, salidas, balance: entradas - salidas }
}

export function sumarMovimientos(turnos: Turno[]): MovimientosTurno {
  return turnos.reduce((acc, t) => {
    const m = movimientosTurno(t)
    return {
      mercadoPago: acc.mercadoPago + m.mercadoPago,
      tarjetas: acc.tarjetas + m.tarjetas,
      pedidosYa: acc.pedidosYa + m.pedidosYa,
      efectivo: acc.efectivo + m.efectivo,
      transferencias: acc.transferencias + m.transferencias,
      proveedores: acc.proveedores + m.proveedores,
      otrosGastos: acc.otrosGastos + m.otrosGastos
    }
  }, MOVIMIENTOS_VACIO)
}

/** Suma de gastos pagados con Mercado Pago (lo que NO es efectivo). */
export function sumaGastosMercadoPago(lineas: LineaGasto[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce((acc, l) => acc + ((l.medioPago ?? 'efectivo') === 'efectivo' ? 0 : l.monto || 0), 0)
}

/** Salidas de caja (plata que sale) de un turno, separadas por medio de pago. */
export interface SalidasCaja {
  // Efectivo
  vales: number
  instructoras: number
  proveedoresEfectivo: number
  otrosEfectivo: number
  // Mercado Pago
  proveedoresMercadoPago: number
}

const SALIDAS_VACIO: SalidasCaja = {
  vales: 0,
  instructoras: 0,
  proveedoresEfectivo: 0,
  otrosEfectivo: 0,
  proveedoresMercadoPago: 0
}

export function salidasCajaTurno(t: Turno): SalidasCaja {
  if (t.tipo === 'manana') {
    const d = t.data as TurnoMananaData
    return {
      vales: 0,
      instructoras: 0,
      proveedoresEfectivo: sumaGastosEfectivo(d.proveedores),
      otrosEfectivo: sumaGastosEfectivo(d.otros),
      proveedoresMercadoPago: sumaGastosMercadoPago(d.proveedores)
    }
  }
  const d = t.data as TurnoNocheData
  return {
    vales: sumaMesas(d.vales),
    instructoras: d.instructoras || 0,
    // En el turno noche las facturas de proveedores se pagan de la caja (efectivo).
    proveedoresEfectivo: sumaMesas(d.facturasProveedores),
    otrosEfectivo: 0,
    proveedoresMercadoPago: 0
  }
}

export function sumarSalidasCaja(turnos: Turno[]): SalidasCaja {
  return turnos.reduce((acc, t) => {
    const s = salidasCajaTurno(t)
    return {
      vales: acc.vales + s.vales,
      instructoras: acc.instructoras + s.instructoras,
      proveedoresEfectivo: acc.proveedoresEfectivo + s.proveedoresEfectivo,
      otrosEfectivo: acc.otrosEfectivo + s.otrosEfectivo,
      proveedoresMercadoPago: acc.proveedoresMercadoPago + s.proveedoresMercadoPago
    }
  }, SALIDAS_VACIO)
}
