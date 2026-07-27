import { jsPDF } from 'jspdf'
import type {
  LineaGasto,
  LineaMesa,
  LineaRubro,
  MailEnvioResultado,
  Turno,
  TurnoMananaData,
  TurnoNocheData
} from '../../../shared/types'
import {
  calcularManana,
  calcularNoche,
  sumaMesas,
  type MovimientosTurno
} from '../../../shared/calc'
import { fechaLinda, formatMoney } from './format'

/** Genera el PDF y lo ABRE en el visor del sistema (en vez de descargarlo). */
async function abrir(doc: jsPDF, nombre: string): Promise<void> {
  const bytes = new Uint8Array(doc.output('arraybuffer'))
  const res = await window.api.abrirPDF(nombre, bytes)
  if (!res.ok) {
    // Si por algún motivo no se pudo abrir, caemos a la descarga clásica.
    doc.save(nombre)
  }
}

function construirTurnoPDF(turno: Turno): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56
  const W = doc.internal.pageSize.getWidth()

  const titulo = turno.tipo === 'manana' ? 'TURNO MAÑANA' : 'TURNO NOCHE'
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`CajaSnack · ${titulo}`, M, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y += 18
  doc.text(`Fecha: ${fechaLinda(turno.fecha)}   ·   Cajero: ${turno.usuarioNombre}`, M, y)
  y += 14
  const cerro = (turno.data as { cerradoPor?: string }).cerradoPor
  doc.text(
    `Estado: ${turno.estado.toUpperCase()}${cerro ? `   ·   Cerró la caja: ${cerro}` : ''}`,
    M,
    y
  )
  y += 22

  const line = (label: string, value: string, bold = false): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, M, y)
    doc.text(value, W - M, y, { align: 'right' })
    y += 16
  }
  const section = (t: string): void => {
    if (y > 740) {
      doc.addPage()
      y = 56
    }
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(t, M, y)
    doc.setLineWidth(0.5)
    doc.line(M, y + 4, W - M, y + 4)
    doc.setFontSize(10)
    y += 18
  }
  const gastosProveedores = (items: LineaGasto[]): void => {
    for (const g of items) {
      const medio = (g.medioPago ?? 'efectivo') === 'efectivo' ? 'efectivo' : 'mercado pago'
      line(`  ${g.concepto || '-'} (${medio})`, formatMoney(g.monto))
    }
  }
  const mesas = (items: LineaMesa[]): void => {
    for (const m of items) line(`  ${m.detalle || '-'}`, formatMoney(m.monto))
  }
  const rubros = (items: LineaRubro[]): void => {
    for (const r of items) line(`  ${r.concepto || '-'}  (paq ${r.paquetes || 0} · cant ${r.cantidad || 0})`, formatMoney(r.monto))
  }

  if (turno.tipo === 'manana') {
    const d = turno.data as TurnoMananaData
    const c = calcularManana(d)
    section('INGRESOS · CAJA')
    line('Caja Base', formatMoney(d.cajaBase))
    line('Facturado Mostrador + Teléfono', formatMoney(d.facturadoMostradorTelefono))
    line('Mesa 49', formatMoney(d.mesa49))
    line('Recibido Mozo', formatMoney(d.recibidoMozo))
    line(`Pool (${d.poolUnidades || 0} × ${formatMoney(d.poolPrecio || 0)})`, formatMoney((d.poolUnidades || 0) * (d.poolPrecio || 0)))
    line('TOTAL + CAJA', formatMoney(c.totalArriba), true)

    section('ENTREGADO · CIERRE')
    line('Caja Dejada Siguiente Turno', formatMoney(d.cajaDejadaSiguienteTurno))
    line('Efectivo Retirado', formatMoney(d.efectivoRetirado))
    line('Tarjetas Retiradas', formatMoney(d.tarjetasRetiradas))
    line('Mercado Pago', formatMoney(d.mercadoPago.reduce((a, m) => a + (m.monto || 0), 0)))
    mesas(d.mercadoPago)
    line('Factura Lincoln', formatMoney((d.facturaLincoln ?? []).reduce((a, m) => a + (m.monto || 0), 0)))
    mesas(d.facturaLincoln ?? [])
    line('Pedidos Ya', formatMoney(d.pedidosYa))
    line('Proveedores (efectivo)', formatMoney(c.proveedoresEfectivo))
    line('Otros gastos (efectivo)', formatMoney(c.otrosEfectivo))
    line('TOTAL ENTREGADO', formatMoney(c.totalAbajo), true)

    section('PAGO A PROVEEDORES')
    gastosProveedores(d.proveedores)
    section('OTROS GASTOS')
    gastosProveedores(d.otros)
    line('TOTAL GASTOS', formatMoney(c.totalGastos), true)

    section('CUADRE')
    line('Diferencia (arriba - abajo)', formatMoney(c.diferencia), true)
    line('Resultado', c.cuadra ? 'CUADRA' : c.diferencia > 0 ? 'FALTA' : 'SOBRA', true)
  } else {
    const d = turno.data as TurnoNocheData
    const c = calcularNoche(d)
    section('APERTURA')
    line('Caja Base', formatMoney(d.apertura.cajaBase))
    if (d.apertura.mozos.length) {
      doc.text('Mozos:', M, y)
      y += 16
      mesas(d.apertura.mozos)
    }
    if (d.apertura.notas) line('Notas', d.apertura.notas)
    line('Firmada por', turno.aprobadoPorNombre || 'PENDIENTE')

    section('MESAS FACTURADAS')
    mesas(d.mesasFacturadas)
    line('Subtotal Facturado', formatMoney(c.totalFacturado), true)
    section('OTRAS MESAS')
    mesas(d.mesasSinFacturar)
    line('Subtotal Otras Mesas', formatMoney(c.totalSinFacturar), true)
    line('TOTAL RESTAURANTE', formatMoney(c.totalRestaurante), true)

    section('ENTREGADO')
    line(`Pool (${d.poolUnidades || 0} × ${formatMoney(d.poolPrecio || 0)})`, formatMoney((d.poolUnidades || 0) * (d.poolPrecio || 0)))
    line('Tarjetas', formatMoney(d.tarjetas))
    line('Efectivo en Caja', formatMoney(d.efectivoEnCaja))
    line('Efectivo en Sobres', formatMoney(d.efectivoEnSobres))
    line('Pedido Ya', formatMoney(d.pedidoYa))
    line('Facturas Proveedores', formatMoney(sumaMesas(d.facturasProveedores)))
    mesas(d.facturasProveedores)
    line('Instructoras', formatMoney(d.instructoras))
    line('Mercado Pago', formatMoney(d.mercadoPago))
    line('Vales', formatMoney(sumaMesas(d.vales)))
    mesas(d.vales)
    line('Transferencias', formatMoney(sumaMesas(d.transferencias)))
    mesas(d.transferencias)
    mesas(d.entregadoExtra)
    line('TOTAL ENTREGADO', formatMoney(c.totalEntregado), true)
    line('APORTE A CAJA GENERAL (sobres + caja - caja base)', formatMoney(c.aporteCajaGeneral), true)

    section('RUBROS')
    line('Total Restaurante', formatMoney(c.totalRestaurante))
    if (d.cumples.length) {
      doc.text('Cumples + Señas:', M, y)
      y += 16
      rubros(d.cumples)
    }
    line('Total Cumples + Señas', formatMoney(c.totalCumples), true)
    if (d.eventos.length) {
      doc.text('Eventos + Señas:', M, y)
      y += 16
      rubros(d.eventos)
    }
    line('Total Eventos + Señas', formatMoney(c.totalEventos), true)
    line('Total Bowling', formatMoney(d.totalBowling))
    line('TOTAL (rubros)', formatMoney(c.totalRubros), true)

    section('CUADRE')
    line('Diferencia (entregado - rubros)', formatMoney(c.diferencia), true)
    line('Resultado', c.cuadra ? 'CUADRA' : 'NO CUADRA', true)
  }

  return doc
}

/** Genera el PDF del turno y lo abre en el visor. */
export async function exportarTurnoPDF(turno: Turno): Promise<void> {
  await abrir(construirTurnoPDF(turno), `caja_${turno.tipo}_${turno.fecha}.pdf`)
}

/** Devuelve los bytes del PDF del turno (para adjuntar en un email, etc.). */
export function bytesTurnoPDF(turno: Turno): Uint8Array {
  return new Uint8Array(construirTurnoPDF(turno).output('arraybuffer'))
}

/**
 * Envía el reporte del turno cerrado por email (best-effort, en segundo plano).
 * Si el email no está configurado, el proceso principal simplemente no hace nada.
 */
export async function enviarCierrePorMail(
  turno: Turno,
  cajero: string
): Promise<MailEnvioResultado> {
  try {
    const tipoLabel = turno.tipo === 'manana' ? 'Mañana' : 'Noche'
    const bytes = bytesTurnoPDF(turno)
    const res = await window.api.enviarCierreMail(bytes, {
      fecha: turno.fecha,
      tipo: turno.tipo,
      tipoLabel,
      cajero
    })
    return res.ok ? res.data : 'pendiente'
  } catch {
    /* el envío nunca debe romper el cierre */
    return 'pendiente'
  }
}

export async function exportarCierreMensualPDF(p: {
  mesLabel: string
  anio: number
  turnos: number
  cerrados: number
  abiertos: number
  totalCaja: number
  falta: number
  sobra: number
  neto: number
  sinCuadrar: number
  mov: MovimientosTurno
}): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56
  const W = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`CajaSnack · CIERRE MENSUAL`, M, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  y += 18
  doc.text(`${p.mesLabel} ${p.anio}`, M, y)
  y += 14
  doc.setFontSize(9)
  doc.text(`Generado: ${fechaLinda(new Date().toISOString().slice(0, 10))}`, M, y)
  doc.setFontSize(10)
  y += 22

  const line = (label: string, value: string, bold = false): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, M, y)
    doc.text(value, W - M, y, { align: 'right' })
    y += 16
  }
  const section = (t: string): void => {
    if (y > 740) {
      doc.addPage()
      y = 56
    }
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(t, M, y)
    doc.setLineWidth(0.5)
    doc.line(M, y + 4, W - M, y + 4)
    doc.setFontSize(10)
    y += 18
  }

  section('RESUMEN DEL MES')
  line('Turnos cargados', String(p.turnos))
  line('Cerrados', String(p.cerrados))
  line('Sin cerrar', String(p.abiertos))
  line('Turnos sin cuadrar', String(p.sinCuadrar))
  line('Total de caja (suma de turnos)', formatMoney(p.totalCaja), true)

  section('DIFERENCIAS')
  line('Faltantes acumulados', formatMoney(p.falta))
  line('Sobrantes acumulados', formatMoney(p.sobra))
  const netoTxt =
    p.neto === 0 ? 'CUADRA' : (p.neto > 0 ? 'FALTA ' : 'SOBRA ') + formatMoney(Math.abs(p.neto))
  line('Diferencia neta', netoTxt, true)

  const electronico = p.mov.tarjetas + p.mov.mercadoPago + p.mov.transferencias + p.mov.pedidosYa
  const cobrado = electronico + p.mov.efectivo
  section('CONCILIACIÓN POR MEDIO DE COBRO')
  line('Efectivo', formatMoney(p.mov.efectivo))
  line('Tarjetas', formatMoney(p.mov.tarjetas))
  line('Mercado Pago', formatMoney(p.mov.mercadoPago))
  line('Transferencias', formatMoney(p.mov.transferencias))
  line('Pedidos Ya', formatMoney(p.mov.pedidosYa))
  line('Total electrónico (a cruzar con banco)', formatMoney(electronico), true)
  line('Total cobrado', formatMoney(cobrado), true)

  section('SALIDAS')
  line('Proveedores', formatMoney(p.mov.proveedores))
  line('Otros gastos', formatMoney(p.mov.otrosGastos))

  await abrir(doc, `cierre_${p.anio}_${p.mesLabel}.pdf`)
}
