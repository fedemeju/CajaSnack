import { useEffect, useState } from 'react'
import {
  turnoMananaVacio,
  POOL_PRECIO_DEFECTO,
  type LineaMesa,
  type LineaRubro,
  type Turno,
  type TurnoMananaData,
  type TurnoNocheData,
  type Usuario
} from '../../../shared/types'
import { calcularManana, calcularNoche } from '../../../shared/calc'
import { fechaLinda, formatMoney } from '../lib/format'
import { GastoEditor, MesaEditor, MoneyField, PoolField } from '../components/lines'
import { useTurno } from '../lib/useTurno'
import { enviarCierrePorMail } from '../lib/pdf'
import { AbrirTurno, GuardadoBadge } from '../components/AbrirTurno'
import { CerrarTurnoModal } from '../components/CerrarTurno'
import { PedirClaveAdmin } from '../components/PedirClaveAdmin'

function normalizarManana(d: TurnoMananaData): TurnoMananaData {
  const legacy = d as unknown as { pool?: number; mercadoPago?: unknown }
  // Caja base: si el turno es viejo (solo número) o no tiene ítems, los armamos
  // a partir del número para poder editarlos como lista.
  let cajaBaseItems = Array.isArray(d.cajaBaseItems) ? d.cajaBaseItems : []
  if (cajaBaseItems.length === 0) {
    cajaBaseItems = d.cajaBase ? [{ detalle: '', monto: d.cajaBase }] : [{ detalle: '', monto: 0 }]
  }
  const cumplesEventos =
    Array.isArray(d.cumplesEventos) && d.cumplesEventos.length
      ? d.cumplesEventos
      : [{ detalle: '', monto: 0 }]
  return {
    ...d,
    cajaBaseItems,
    cumplesEventos,
    poolUnidades: typeof d.poolUnidades === 'number' ? d.poolUnidades : 0,
    poolPrecio: typeof d.poolPrecio === 'number' && d.poolPrecio > 0 ? d.poolPrecio : POOL_PRECIO_DEFECTO,
    mercadoPago: Array.isArray(legacy.mercadoPago)
      ? (legacy.mercadoPago as TurnoMananaData['mercadoPago'])
      : []
  }
}

export function TurnoManana({ user }: { user: Usuario }): JSX.Element {
  const t = useTurno<TurnoMananaData>('manana', user, turnoMananaVacio, normalizarManana)
  const [reabrirAbierto, setReabrirAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  if (!t.entrado) {
    return (
      <AbrirTurno
        titulo="Turno Mañana"
        fecha={t.fecha}
        setFecha={t.setFecha}
        existente={t.existente}
        pendiente={t.pendiente}
        error={t.error}
        onAbrir={t.abrir}
      />
    )
  }

  const data = t.data
  const cuadre = calcularManana(data)
  const readOnly = t.readOnly
  const set = t.setData
  const cajaBaseItems = data.cajaBaseItems ?? []
  const cajaBaseTotal = cajaBaseItems.reduce((a, m) => a + (m.monto || 0), 0)

  const avisoDif =
    (cuadre.diferencia > 0 ? 'FALTA ' : 'SOBRA ') + formatMoney(Math.abs(cuadre.diferencia))

  return (
    <div className="turno-page">
      <div className="page-title">
        <h1>Turno Mañana · {fechaLinda(t.fecha)}</h1>
        <GuardadoBadge guardando={t.guardando} guardadoLabel={t.guardadoLabel} />
      </div>

      {readOnly && (
        <div className="banner info">
          Este turno ya está <b>cerrado</b> (solo lectura). Cargado por {t.turno?.usuarioNombre} el{' '}
          {fechaLinda(t.fecha)}.
        </div>
      )}

      <CierreAnterior fecha={diaAnterior(t.fecha)} />

      <div className="grid cols-2">
        <div className="card card-rendir">
          <h2>Ingresos · Caja</h2>
          <div className="card-body">
            <div className="field" style={{ display: 'block' }}>
              <label>Caja Base (uno o varios ingresos)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={cajaBaseItems}
                  disabled={readOnly}
                  placeholder="Concepto (opcional)"
                  onChange={(v) =>
                    set({ cajaBaseItems: v, cajaBase: v.reduce((a, m) => a + (m.monto || 0), 0) })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>Total Caja Base</label>
              <span>{formatMoney(cajaBaseTotal)}</span>
            </div>
            <MoneyField
              label="Facturado Mostrador + Teléfono"
              value={data.facturadoMostradorTelefono}
              disabled={readOnly}
              onChange={(v) => set({ facturadoMostradorTelefono: v })}
            />
            <MoneyField label="Mesa 49" value={data.mesa49} disabled={readOnly} onChange={(v) => set({ mesa49: v })} />
            <MoneyField label="Recibido Mozo" value={data.recibidoMozo} disabled={readOnly} onChange={(v) => set({ recibidoMozo: v })} />
            <div className="field" style={{ display: 'block' }}>
              <label>Cumples y Eventos (uno o varios)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={data.cumplesEventos ?? []}
                  disabled={readOnly}
                  placeholder="Cumple / evento (opcional)"
                  onChange={(v) => set({ cumplesEventos: v })}
                />
              </div>
            </div>
            <PoolField
              unidades={data.poolUnidades}
              precio={data.poolPrecio}
              disabled={readOnly}
              onUnidades={(n) => set({ poolUnidades: n })}
              onPrecio={(n) => set({ poolPrecio: n })}
            />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              El Pool se <b>resta</b> del Total + Caja.
            </div>
            <div className="subtotal rendir">
              <span>Total + Caja</span>
              <span>{formatMoney(cuadre.totalArriba)}</span>
            </div>
          </div>
        </div>

        <div className="card card-entrega">
          <h2>Entregado · Cierre</h2>
          <div className="card-body">
            <MoneyField
              label="Caja Dejada Siguiente Turno"
              value={data.cajaDejadaSiguienteTurno}
              disabled={readOnly}
              onChange={(v) => set({ cajaDejadaSiguienteTurno: v })}
            />
            <MoneyField label="Efectivo Retirado" value={data.efectivoRetirado} disabled={readOnly} onChange={(v) => set({ efectivoRetirado: v })} />
            <MoneyField label="Tarjetas Retiradas" value={data.tarjetasRetiradas} disabled={readOnly} onChange={(v) => set({ tarjetasRetiradas: v })} />
            <div className="field" style={{ display: 'block' }}>
              <label>Mercado Pago (cada cobro)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={data.mercadoPago}
                  disabled={readOnly}
                  placeholder="Detalle (opcional)"
                  onChange={(v) => set({ mercadoPago: v })}
                />
              </div>
            </div>
            <MoneyField label="Pedidos Ya" value={data.pedidosYa} disabled={readOnly} onChange={(v) => set({ pedidosYa: v })} />
            <div className="gastos-destacado">
              <div className="gastos-destacado-titulo">Gastos pagados (salen de la caja)</div>
              <div className="field">
                <label>Proveedores (efectivo)</label>
                <span>{formatMoney(cuadre.proveedoresEfectivo)}</span>
              </div>
              <div className="field" style={{ borderBottom: 0 }}>
                <label>Otros gastos (efectivo)</label>
                <span>{formatMoney(cuadre.otrosEfectivo)}</span>
              </div>
              <div className="gastos-destacado-total">
                <span>Total gastos en efectivo</span>
                <span>{formatMoney(cuadre.proveedoresEfectivo + cuadre.otrosEfectivo)}</span>
              </div>
            </div>
            <div className="subtotal entrega">
              <span>Total Entregado</span>
              <span>{formatMoney(cuadre.totalAbajo)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Pago a Proveedores</h2>
          <div className="card-body">
            <GastoEditor items={data.proveedores} disabled={readOnly} medioPago onChange={(items) => set({ proveedores: items })} />
          </div>
        </div>
        <div className="card">
          <h2>Otros Gastos</h2>
          <div className="card-body">
            <GastoEditor items={data.otros} disabled={readOnly} medioPago onChange={(items) => set({ otros: items })} />
          </div>
        </div>
      </div>

      <div className="banner warn" style={{ marginTop: 18 }}>
        Total de gastos del turno: <b>{formatMoney(cuadre.totalGastos)}</b> (proveedores + otros).
      </div>

      <div style={{ marginTop: 18 }}>
        <CuadreBanner cuadre={cuadre} />
      </div>

      <div className="actions-bar">
        <button className="btn" onClick={t.volver}>
          ← Volver
        </button>
        {readOnly ? (
          <button className="btn btn-primary" onClick={() => setReabrirAbierto(true)}>
            Reabrir turno
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setCerrando(true)}>
            Cerrar turno
          </button>
        )}
      </div>

      {t.error && <div className="error">{t.error}</div>}

      {reabrirAbierto && (
        <PedirClaveAdmin
          titulo="Reabrir turno cerrado"
          mensaje="Este turno ya está cerrado. Para reabrirlo y corregirlo hace falta la contraseña de un administrador."
          confirmar="Reabrir turno"
          accion={(password) => t.reabrir(password)}
          onListo={() => setReabrirAbierto(false)}
          onClose={() => setReabrirAbierto(false)}
        />
      )}

      {cerrando && (
        <CerrarTurnoModal
          cuadra={cuadre.cuadra}
          avisoDiferencia={avisoDif}
          onConfirm={async (nombre) => {
            const res = await t.cerrar(nombre)
            if (res.ok) enviarCierrePorMail(res.data, nombre)
            return res
          }}
          onClose={() => setCerrando(false)}
        />
      )}
    </div>
  )
}

export function CuadreBanner({
  cuadre
}: {
  cuadre: { totalArriba: number; totalAbajo: number; diferencia: number; cuadra: boolean }
}): JSX.Element {
  return (
    <div className={`cuadre ${cuadre.cuadra || cuadre.diferencia < 0 ? 'ok' : 'bad'}`}>
      <div className="totales">
        <div>
          <b>Total Arriba</b>
          {formatMoney(cuadre.totalArriba)}
        </div>
        <div>
          <b>Total Abajo</b>
          {formatMoney(cuadre.totalAbajo)}
        </div>
      </div>
      <div className="dif">
        {cuadre.cuadra
          ? '✓ La caja cuadra'
          : cuadre.diferencia < 0
            ? `Sobraron ${formatMoney(Math.abs(cuadre.diferencia))}`
            : `Faltó ${formatMoney(cuadre.diferencia)}`}
      </div>
    </div>
  )
}

/** "2026-05-28" -> "2026-05-27" (un día antes, en formato ISO local). */
function diaAnterior(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return dt.toLocaleDateString('en-CA')
}

function Fila({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <span>{formatMoney(value)}</span>
    </div>
  )
}

function ListaDetalle({
  titulo,
  items,
  campo
}: {
  titulo: string
  items: LineaMesa[] | LineaRubro[]
  campo: 'detalle' | 'concepto'
}): JSX.Element | null {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="field" style={{ display: 'block' }}>
      <label>{titulo}</label>
      <div className="prev-lista">
        {items.map((it, i) => (
          <div className="prev-lista-row" key={i}>
            <span>{(it as unknown as Record<string, unknown>)[campo]?.toString() || '—'}</span>
            <span>{formatMoney(it.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Panel de solo lectura con el cierre del turno noche del día anterior. */
function CierreAnterior({ fecha }: { fecha: string }): JSX.Element | null {
  const [turno, setTurno] = useState<Turno | null>(null)
  const [cargado, setCargado] = useState(false)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargado(false)
    window.api.obtenerTurnoPorFecha(fecha, 'noche').then((res) => {
      if (!vivo) return
      setTurno(res.ok ? res.data : null)
      setCargado(true)
    })
    return () => {
      vivo = false
    }
  }, [fecha])

  if (!cargado) return null
  if (!turno) {
    return (
      <div className="banner info" style={{ marginBottom: 18 }}>
        No hay turno noche cargado del <b>{fechaLinda(fecha)}</b> para comparar.
      </div>
    )
  }

  const d = turno.data as TurnoNocheData
  const c = calcularNoche(d)
  const efectivoCaja = d.efectivoEnCaja || 0
  const efectivoSobres = d.efectivoEnSobres || 0
  const poolTotal = (d.poolUnidades || 0) * (d.poolPrecio || 0)

  return (
    <div className="card prev-card" style={{ marginBottom: 18 }}>
      <div className="prev-head">
        <div>
          <h2>Cierre del turno anterior · Noche del {fechaLinda(fecha)}</h2>
          <span className="prev-sub">
            Cargado por {turno.usuarioNombre} · <span className={`pill ${turno.estado}`}>{turno.estado}</span>
          </span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setAbierto((o) => !o)}>
          {abierto ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>
      <div className="card-body">
        <div className="prev-cash">
          <div className="counter">
            <div className="counter-label">Efectivo en Caja</div>
            <div className="counter-value">{formatMoney(efectivoCaja)}</div>
          </div>
          <div className="counter">
            <div className="counter-label">Efectivo en Sobres</div>
            <div className="counter-value">{formatMoney(efectivoSobres)}</div>
          </div>
          <div className="counter">
            <div className="counter-label">Total efectivo dejado</div>
            <div className="counter-value">{formatMoney(efectivoCaja + efectivoSobres)}</div>
          </div>
        </div>

        {abierto && (
          <div className="grid cols-2 prev-detalle">
            <div>
              <h3 className="prev-titulo">Apertura</h3>
              <Fila label="Caja Base" value={d.apertura?.cajaBase || 0} />
              <ListaDetalle titulo="Mozos" items={d.apertura?.mozos ?? []} campo="detalle" />

              <h3 className="prev-titulo">Facturación</h3>
              <ListaDetalle
                titulo="Mesas Facturadas"
                items={(d.mesasFacturadas ?? []).filter((m) => m.monto)}
                campo="detalle"
              />
              <Fila label="Total Mesas Facturadas" value={c.totalFacturado} />
              <ListaDetalle
                titulo="Mesas Sin Facturar"
                items={(d.mesasSinFacturar ?? []).filter((m) => m.monto)}
                campo="detalle"
              />
              <Fila label="Total Mesas Sin Facturar" value={c.totalSinFacturar} />
              <Fila label="Total Restaurante" value={c.totalRestaurante} />

              <h3 className="prev-titulo">Rubros</h3>
              <ListaDetalle titulo="Cumples + Señas" items={d.cumples ?? []} campo="concepto" />
              <Fila label="Total Cumples + Señas" value={c.totalCumples} />
              <ListaDetalle titulo="Eventos + Señas" items={d.eventos ?? []} campo="concepto" />
              <Fila label="Total Eventos + Señas" value={c.totalEventos} />
              <Fila label="Total Bowling" value={d.totalBowling || 0} />
              <Fila label="Total Rubros" value={c.totalRubros} />
            </div>

            <div>
              <h3 className="prev-titulo">Entregado</h3>
              <Fila
                label={`Pool (${d.poolUnidades || 0} × ${formatMoney(d.poolPrecio || 0)})`}
                value={poolTotal}
              />
              <Fila label="Tarjetas" value={d.tarjetas || 0} />
              <Fila label="Efectivo en Caja" value={efectivoCaja} />
              <Fila label="Efectivo en Sobres" value={efectivoSobres} />
              <Fila label="Pedido Ya" value={d.pedidoYa || 0} />
              <ListaDetalle titulo="Facturas Proveedores" items={d.facturasProveedores ?? []} campo="detalle" />
              <Fila label="Instructoras" value={d.instructoras || 0} />
              <Fila label="Mercado Pago" value={d.mercadoPago || 0} />
              <ListaDetalle titulo="Vales" items={d.vales ?? []} campo="detalle" />
              <ListaDetalle titulo="Transferencias" items={d.transferencias ?? []} campo="detalle" />
              <ListaDetalle titulo="Entregado Extra" items={d.entregadoExtra ?? []} campo="detalle" />
              <Fila label="Total Entregado" value={c.totalEntregado} />
            </div>
          </div>
        )}

        {abierto && (
          <div className={`prev-cuadre ${c.cuadra || c.diferencia > 0 ? 'ok' : 'bad'}`}>
            {c.cuadra
              ? '✓ El turno anterior cuadraba'
              : `El turno anterior ${c.diferencia > 0 ? 'tenía sobrante' : 'tenía faltante'} de ${formatMoney(Math.abs(c.diferencia))}`}
          </div>
        )}
      </div>
    </div>
  )
}
