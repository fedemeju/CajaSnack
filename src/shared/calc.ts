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

export function sumaRubro(lineas: LineaRubro[]): number {
  if (!Array.isArray(lineas)) return 0
  return lineas.reduce((acc, l) => acc + (l.monto || 0), 0)
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
  const totalArriba =
    (d.cajaBase || 0) +
    (d.facturadoMostradorTelefono || 0) +
    (d.mesa49 || 0) +
    (d.recibidoMozo || 0) +
    totalPool
  const proveedoresEfectivo = sumaGastosEfectivo(d.proveedores)
  const otrosEfectivo = sumaGastosEfectivo(d.otros)
  const totalAbajo =
    (d.cajaDejadaSiguienteTurno || 0) +
    (d.efectivoRetirado || 0) +
    (d.tarjetasRetiradas || 0) +
    sumaMesas(d.mercadoPago) +
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

  const totalCumples = sumaRubro(d.cumples)
  const totalEventos = sumaRubro(d.eventos)

  const totalRubros = totalRestaurante + (d.totalBowling || 0) + totalCumples + totalEventos

  const diferencia = totalEntregado - totalRubros
  return {
    totalFacturado,
    totalSinFacturar,
    totalRestaurante,
    totalEntregado,
    totalCumples,
    totalEventos,
    totalRubros,
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
  return { total: c.totalRestaurante, cuadra: c.cuadra, diferencia: c.diferencia }
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
  const entradas = m.mercadoPago + m.tarjetas + m.pedidosYa + m.efectivo
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
