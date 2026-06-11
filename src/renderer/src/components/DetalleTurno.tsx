import type { ReactNode } from 'react'
import type { Turno, TurnoMananaData, TurnoNocheData } from '../../../shared/types'
import { calcularManana, calcularNoche, sumaMesas } from '../../../shared/calc'
import { fechaLinda, fechaHora, formatMoney } from '../lib/format'

function Fila({ label, value, fuerte }: { label: string; value: string; fuerte?: boolean }): JSX.Element {
  return (
    <div className="det-fila" style={fuerte ? { fontWeight: 700 } : undefined}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }): JSX.Element {
  return (
    <div className="det-seccion">
      <div className="det-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function Lineas({ items }: { items: { detalle: string; monto: number }[] }): JSX.Element {
  return (
    <>
      {items
        .filter((m) => m.detalle || m.monto)
        .map((m, i) => (
          <Fila key={i} label={`· ${m.detalle || '-'}`} value={formatMoney(m.monto)} />
        ))}
    </>
  )
}

/** Vista de detalle de un turno (solo lectura), para abrir desde Reportes. */
export function DetalleTurno({ turno, onClose }: { turno: Turno; onClose: () => void }): JSX.Element {
  const cerro = (turno.data as { cerradoPor?: string }).cerradoPor
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal det-modal" onClick={(e) => e.stopPropagation()}>
        <div className="det-head">
          <div>
            <h3 style={{ margin: 0 }}>
              {turno.tipo === 'manana' ? 'Turno Mañana' : 'Turno Noche'} · {fechaLinda(turno.fecha)}
            </h3>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              Cajero: {turno.usuarioNombre} · Estado: {turno.estado}
              {cerro ? ` · Cerró la caja: ${cerro}` : ''}
            </div>
          </div>
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="det-body">
          {turno.tipo === 'manana' ? (
            <DetalleManana d={turno.data as TurnoMananaData} />
          ) : (
            <DetalleNoche turno={turno} />
          )}
        </div>
      </div>
    </div>
  )
}

function DetalleManana({ d }: { d: TurnoMananaData }): JSX.Element {
  const c = calcularManana(d)
  return (
    <>
      <Seccion titulo="Ingresos · Caja">
        <Fila label="Caja Base" value={formatMoney(d.cajaBase)} />
        <Fila label="Facturado Mostrador + Teléfono" value={formatMoney(d.facturadoMostradorTelefono)} />
        <Fila label="Mesa 49" value={formatMoney(d.mesa49)} />
        <Fila label="Recibido Mozo" value={formatMoney(d.recibidoMozo)} />
        <Fila
          label={`Pool (${d.poolUnidades || 0} × ${formatMoney(d.poolPrecio || 0)})`}
          value={formatMoney((d.poolUnidades || 0) * (d.poolPrecio || 0))}
        />
        <Fila label="TOTAL + CAJA" value={formatMoney(c.totalArriba)} fuerte />
      </Seccion>

      <Seccion titulo="Entregado · Cierre">
        <Fila label="Caja Dejada Siguiente Turno" value={formatMoney(d.cajaDejadaSiguienteTurno)} />
        <Fila label="Efectivo Retirado" value={formatMoney(d.efectivoRetirado)} />
        <Fila label="Tarjetas Retiradas" value={formatMoney(d.tarjetasRetiradas)} />
        <Fila label="Mercado Pago" value={formatMoney(sumaMesas(d.mercadoPago))} />
        <Lineas items={d.mercadoPago} />
        <Fila label="Pedidos Ya" value={formatMoney(d.pedidosYa)} />
        <Fila label="Proveedores (efectivo)" value={formatMoney(c.proveedoresEfectivo)} />
        <Fila label="Otros gastos (efectivo)" value={formatMoney(c.otrosEfectivo)} />
        <Fila label="TOTAL ENTREGADO" value={formatMoney(c.totalAbajo)} fuerte />
      </Seccion>

      {(d.proveedores.length > 0 || d.otros.length > 0) && (
        <Seccion titulo="Gastos">
          {d.proveedores.map((g, i) => (
            <Fila
              key={'p' + i}
              label={`Proveedor: ${g.concepto || '-'} (${(g.medioPago ?? 'efectivo') === 'efectivo' ? 'efectivo' : 'MP'})`}
              value={formatMoney(g.monto)}
            />
          ))}
          {d.otros.map((g, i) => (
            <Fila
              key={'o' + i}
              label={`Otro: ${g.concepto || '-'} (${(g.medioPago ?? 'efectivo') === 'efectivo' ? 'efectivo' : 'MP'})`}
              value={formatMoney(g.monto)}
            />
          ))}
          <Fila label="TOTAL GASTOS" value={formatMoney(c.totalGastos)} fuerte />
        </Seccion>
      )}

      <div className={`det-cuadre ${c.cuadra ? 'ok' : 'bad'}`}>
        {c.cuadra
          ? '✓ La caja cuadra'
          : `${c.diferencia > 0 ? 'FALTA' : 'SOBRA'} ${formatMoney(Math.abs(c.diferencia))}`}
      </div>
    </>
  )
}

function DetalleNoche({ turno }: { turno: Turno }): JSX.Element {
  const d = turno.data as TurnoNocheData
  const c = calcularNoche(d)
  return (
    <>
      <Seccion titulo="Apertura">
        <Fila label="Caja Base" value={formatMoney(d.apertura.cajaBase)} />
        <Lineas items={d.apertura.mozos} />
        <Fila
          label="Firmada por"
          value={turno.aprobadoPorNombre ? `${turno.aprobadoPorNombre}${turno.aprobadoAt ? ' · ' + fechaHora(turno.aprobadoAt) : ''}` : 'PENDIENTE'}
        />
        {d.apertura.notas ? <Fila label="Notas" value={d.apertura.notas} /> : null}
      </Seccion>

      <Seccion titulo="Restaurante">
        <Fila label="Mesas fichadas" value={formatMoney(c.totalFacturado)} />
        <Lineas items={d.mesasFacturadas} />
        <Fila label="Mesas sin facturar" value={formatMoney(c.totalSinFacturar)} />
        <Lineas items={d.mesasSinFacturar} />
        <Fila label="TOTAL RESTAURANTE" value={formatMoney(c.totalRestaurante)} fuerte />
      </Seccion>

      <Seccion titulo="Otros rubros">
        <Fila label="Bowling" value={formatMoney(d.totalBowling)} />
        <Fila label="Cumples + Señas" value={formatMoney(c.totalCumples)} />
        <Fila label="Eventos + Señas" value={formatMoney(c.totalEventos)} />
        <Fila label="TOTAL (rubros + restaurante)" value={formatMoney(c.totalRubros)} fuerte />
      </Seccion>

      <Seccion titulo="Entregado">
        <Fila
          label={`Pool (${d.poolUnidades || 0} × ${formatMoney(d.poolPrecio || 0)})`}
          value={formatMoney((d.poolUnidades || 0) * (d.poolPrecio || 0))}
        />
        <Fila label="Tarjetas" value={formatMoney(d.tarjetas)} />
        <Fila label="Efectivo en Caja" value={formatMoney(d.efectivoEnCaja)} />
        <Fila label="Efectivo en Sobres" value={formatMoney(d.efectivoEnSobres)} />
        <Fila label="Pedido Ya" value={formatMoney(d.pedidoYa)} />
        <Fila label="Facturas Proveedores" value={formatMoney(sumaMesas(d.facturasProveedores))} />
        <Fila label="Instructoras" value={formatMoney(d.instructoras)} />
        <Fila label="Mercado Pago" value={formatMoney(d.mercadoPago)} />
        <Fila label="Vales" value={formatMoney(sumaMesas(d.vales))} />
        <Fila label="Transferencias" value={formatMoney(sumaMesas(d.transferencias))} />
        {sumaMesas(d.entregadoExtra) > 0 && (
          <Fila label="Otros conceptos" value={formatMoney(sumaMesas(d.entregadoExtra))} />
        )}
        <Fila label="TOTAL ENTREGADO" value={formatMoney(c.totalEntregado)} fuerte />
      </Seccion>

      <div className="aporte-caja">
        <div className="aporte-caja-titulo">APORTE A CAJA GENERAL</div>
        <div className="aporte-caja-fila">
          <span>Efectivo en sobres + efectivo en caja − caja base</span>
          <span className="aporte-caja-monto">{formatMoney(c.aporteCajaGeneral)}</span>
        </div>
      </div>

      <div className={`det-cuadre ${c.cuadra || c.diferencia > 0 ? 'ok' : 'bad'}`}>
        {c.cuadra
          ? '✓ Lo entregado coincide'
          : c.diferencia > 0
            ? `Sobraron ${formatMoney(c.diferencia)}`
            : `Faltó ${formatMoney(Math.abs(c.diferencia))}`}
      </div>
    </>
  )
}
