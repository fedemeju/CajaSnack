import { useState } from 'react'
import {
  turnoNocheVacio,
  type TurnoNocheData,
  type Turno,
  type Usuario
} from '../../../shared/types'
import { calcularNoche, sumaMesas } from '../../../shared/calc'
import { fechaHora, fechaLinda, formatMoney } from '../lib/format'
import { getPoolPrecio } from '../lib/poolPrecio'
import { MesaEditor, MoneyField, PoolField, RubroEditor } from '../components/lines'
import { useTurno } from '../lib/useTurno'
import { enviarCierrePorMail } from '../lib/pdf'
import { AbrirTurno, GuardadoBadge } from '../components/AbrirTurno'
import { CerrarTurnoModal } from '../components/CerrarTurno'
import { PedirClaveAdmin } from '../components/PedirClaveAdmin'

function normalizarNoche(d: TurnoNocheData): TurnoNocheData {
  const ap = (d.apertura ?? {}) as Partial<TurnoNocheData['apertura']>
  return {
    ...d,
    apertura: {
      cajaBase: typeof ap.cajaBase === 'number' ? ap.cajaBase : 0,
      mozos: Array.isArray(ap.mozos) ? ap.mozos : [],
      notas: typeof ap.notas === 'string' ? ap.notas : ''
    },
    poolUnidades: typeof d.poolUnidades === 'number' ? d.poolUnidades : 0,
    poolPrecio: typeof d.poolPrecio === 'number' && d.poolPrecio > 0 ? d.poolPrecio : getPoolPrecio(),
    facturasProveedores: Array.isArray(d.facturasProveedores) ? d.facturasProveedores : [],
    vales: Array.isArray(d.vales) ? d.vales : [],
    transferencias: Array.isArray(d.transferencias) ? d.transferencias : []
  }
}

export function TurnoNoche({ user }: { user: Usuario }): JSX.Element {
  const t = useTurno<TurnoNocheData>(
    'noche',
    user,
    () => ({ ...turnoNocheVacio(), poolPrecio: getPoolPrecio() }),
    normalizarNoche
  )
  const [reabrirAbierto, setReabrirAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [verFacturado, setVerFacturado] = useState(false)

  if (!t.entrado) {
    return (
      <AbrirTurno
        titulo="Turno Noche"
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
  const c = calcularNoche(data)
  // Total facturado día y noche = Mozos de la apertura (lo que fichó el día) +
  // subtotal de Mesas Fichadas (lo de la noche). Solo informativo, no toca el cuadre.
  const totalFacturadoDiaNoche = sumaMesas(data.apertura?.mozos) + sumaMesas(data.mesasFacturadas)
  const readOnly = t.readOnly
  const aperturaFirmada = !!t.turno?.aprobadoPor
  const aperturaBloqueada = readOnly || aperturaFirmada
  const set = t.setData
  const setAp = (patch: Partial<TurnoNocheData['apertura']>): void =>
    set({ apertura: { ...data.apertura, ...patch } })

  const avisoDif =
    (c.diferencia > 0 ? 'SOBRA ' : 'FALTA ') + formatMoney(Math.abs(c.diferencia))

  return (
    <div className="turno-page">
      <div className="page-title">
        <h1>Turno Noche · {fechaLinda(t.fecha)}</h1>
        <GuardadoBadge guardando={t.guardando} guardadoLabel={t.guardadoLabel} />
      </div>

      {readOnly && (
        <div className="banner info">
          Este turno ya está <b>cerrado</b> (solo lectura). Cargado por {t.turno?.usuarioNombre}.
        </div>
      )}

      <div className="card">
        <h2>Apertura del turno (la revisa y firma el turno mañana)</h2>
        <div className="card-body">
          <div className="caja-base-destacada">
            <MoneyField label="Caja Base" value={data.apertura.cajaBase} disabled={aperturaBloqueada} onChange={(v) => setAp({ cajaBase: v })} />
          </div>
          <div className="field" style={{ display: 'block' }}>
            <label>Mozos</label>
            <div style={{ marginTop: 8 }}>
              <MesaEditor
                items={data.apertura.mozos}
                disabled={aperturaBloqueada}
                placeholder="Mozo / Mesa"
                onChange={(v) => setAp({ mozos: v })}
              />
            </div>
          </div>

          <FirmaApertura turno={t.turno} onFirmado={t.actualizarTurno} />
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        {/* IZQUIERDA — azul: lo que se debe rendir */}
        <div className="grid">
          <div className="card card-rendir">
            <h2>Mesas fichadas (mozos)</h2>
            <div className="card-body">
              <MesaEditor items={data.mesasFacturadas} disabled={readOnly} onChange={(v) => set({ mesasFacturadas: v })} />
            </div>
          </div>
          <div className="card card-rendir">
            <h2>Otras Mesas</h2>
            <div className="card-body">
              <MesaEditor items={data.mesasSinFacturar} disabled={readOnly} onChange={(v) => set({ mesasSinFacturar: v })} />
            </div>
          </div>

          <div className="banner info" style={{ margin: 0 }}>
            <b>Total Restaurante</b> = Caja Base ({formatMoney(data.apertura.cajaBase)}) + Facturado (
            {formatMoney(c.totalFacturado)}) + Otras Mesas ({formatMoney(c.totalSinFacturar)}) ={' '}
            <b>{formatMoney(c.totalRestaurante)}</b>
          </div>

          <div className="card card-rendir">
            <h2>Totales</h2>
            <div className="card-body">
              <div className="field" style={{ borderTop: 0 }}>
                <label>Total Restaurante</label>
                <span>{formatMoney(c.totalRestaurante)}</span>
              </div>

              <div className="field" style={{ display: 'block' }}>
                <label>Cumples + Señas</label>
                <div style={{ marginTop: 8 }}>
                  <RubroEditor items={data.cumples} disabled={readOnly} onChange={(v) => set({ cumples: v })} />
                </div>
              </div>
              <div className="field">
                <label>Total Cumples + Señas</label>
                <span>{formatMoney(c.totalCumples)}</span>
              </div>

              <div className="field" style={{ display: 'block' }}>
                <label>Eventos + Señas</label>
                <div style={{ marginTop: 8 }}>
                  <RubroEditor items={data.eventos} disabled={readOnly} onChange={(v) => set({ eventos: v })} />
                </div>
              </div>
              <div className="field">
                <label>Total Eventos + Señas</label>
                <span>{formatMoney(c.totalEventos)}</span>
              </div>

              <MoneyField label="Total Bowling" value={data.totalBowling} disabled={readOnly} onChange={(v) => set({ totalBowling: v })} />
              <div className="subtotal rendir">
                <span>Total (rubros + restaurante)</span>
                <span>{formatMoney(c.totalRubros)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DERECHA — verde: lo que se entrega */}
        <div className="card card-entrega">
          <h2>Entregado</h2>
          <div className="card-body">
            <PoolField
              unidades={data.poolUnidades}
              precio={data.poolPrecio}
              disabled={readOnly}
              onUnidades={(n) => set({ poolUnidades: n })}
              onPrecio={(n) => set({ poolPrecio: n })}
            />
            <MoneyField label="Tarjetas" value={data.tarjetas} disabled={readOnly} onChange={(v) => set({ tarjetas: v })} />
            <MoneyField label="Efectivo en Caja" value={data.efectivoEnCaja} disabled={readOnly} onChange={(v) => set({ efectivoEnCaja: v })} />
            <MoneyField label="Efectivo en Sobres" value={data.efectivoEnSobres} disabled={readOnly} onChange={(v) => set({ efectivoEnSobres: v })} />
            <MoneyField label="Pedido Ya" value={data.pedidoYa} disabled={readOnly} onChange={(v) => set({ pedidoYa: v })} />
            <div className="field" style={{ display: 'block' }}>
              <label>Facturas Proveedores (cada importe)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={data.facturasProveedores}
                  disabled={readOnly}
                  placeholder="Detalle (opcional)"
                  onChange={(v) => set({ facturasProveedores: v })}
                />
              </div>
            </div>
            <MoneyField label="Instructoras" value={data.instructoras} disabled={readOnly} onChange={(v) => set({ instructoras: v })} />
            <MoneyField label="Mercado Pago" value={data.mercadoPago} disabled={readOnly} onChange={(v) => set({ mercadoPago: v })} />
            {!readOnly && (
              <TraerMP onImport={(monto) => set({ mercadoPago: monto })} />
            )}
            <div className="field" style={{ display: 'block' }}>
              <label>Vales (cada importe)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={data.vales}
                  disabled={readOnly}
                  placeholder="Detalle (opcional)"
                  onChange={(v) => set({ vales: v })}
                />
              </div>
            </div>
            <div className="field" style={{ display: 'block' }}>
              <label>Transferencias (cada importe)</label>
              <div style={{ marginTop: 8 }}>
                <MesaEditor
                  items={data.transferencias}
                  disabled={readOnly}
                  placeholder="Detalle (opcional)"
                  onChange={(v) => set({ transferencias: v })}
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)' }}>
                Otros conceptos
              </label>
              <MesaEditor
                items={data.entregadoExtra}
                disabled={readOnly}
                placeholder="Otro concepto"
                onChange={(v) => set({ entregadoExtra: v })}
              />
            </div>
            <div className="subtotal entrega">
              <span>Total Entregado</span>
              <span>{formatMoney(c.totalEntregado)}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`cuadre ${c.cuadra || c.diferencia > 0 ? 'ok' : 'bad'}`}
        style={{ marginTop: 18 }}
      >
        <div className="totales">
          <div>
            <b>Total Entregado</b>
            {formatMoney(c.totalEntregado)}
          </div>
          <div>
            <b>Total (rubros)</b>
            {formatMoney(c.totalRubros)}
          </div>
        </div>
        <div className="dif">
          {c.cuadra
            ? '✓ Lo entregado coincide'
            : c.diferencia > 0
              ? `Sobraron ${formatMoney(c.diferencia)}`
              : `Faltó ${formatMoney(Math.abs(c.diferencia))}`}
        </div>
      </div>

      <div className="fact-diaynoche">
        {verFacturado ? (
          <div className="fact-diaynoche-open">
            <div>
              <div className="fact-diaynoche-label">Total facturado día y noche</div>
              <div className="fact-diaynoche-sub">
                Mozos apertura ({formatMoney(sumaMesas(data.apertura?.mozos))}) + Mesas Fichadas (
                {formatMoney(sumaMesas(data.mesasFacturadas))})
              </div>
            </div>
            <div className="fact-diaynoche-monto">{formatMoney(totalFacturadoDiaNoche)}</div>
            <button type="button" className="btn btn-ghost" onClick={() => setVerFacturado(false)}>
              Ocultar
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setVerFacturado(true)}>
            Ver total facturado día y noche
          </button>
        )}
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
          cuadra={c.cuadra}
          avisoDiferencia={avisoDif}
          onConfirm={(nombre) => t.cerrar(nombre)}
          enviarMail={(turno, nombre) => enviarCierrePorMail(turno, nombre)}
          onClose={() => setCerrando(false)}
        />
      )}
    </div>
  )
}

/** Botón que trae el total de Mercado Pago desde la extensión "Calculadora MP"
 *  (vía portapapeles). Completa el campo Mercado Pago con QR + Point. */
function TraerMP({ onImport }: { onImport: (monto: number) => void }): JSX.Element {
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')

  async function traer(): Promise<void> {
    setErr('')
    setInfo('')
    const res = await window.api.leerPortapapeles()
    if (!res.ok) {
      setErr('No se pudo leer el portapapeles.')
      return
    }
    const txt = (res.data || '').trim()
    const i = txt.indexOf('CAJASNACK-MP')
    if (i < 0) {
      setErr('No encontré datos de MP. En la extensión, tocá "Copiar para CajaSnack" y volvé a probar.')
      return
    }
    try {
      const p = JSON.parse(txt.slice(txt.indexOf('{', i)))
      const mp = Math.round(Number(p.mercadoPago) || 0)
      onImport(mp)
      const point = Math.round(Number(p.point) || 0)
      const trans = Math.round(Number(p.trans) || 0)
      let msg = `✓ Mercado Pago (QR): ${formatMoney(mp)}.`
      const aparte: string[] = []
      if (point > 0) aparte.push(`Point ${formatMoney(point)}`)
      if (trans > 0) aparte.push(`Transferencias ${formatMoney(trans)}`)
      if (aparte.length) {
        msg += ` Detectado aparte: ${aparte.join(' · ')} — cargalo donde corresponda.`
      }
      setInfo(msg)
    } catch {
      setErr('El texto del portapapeles no tiene el formato esperado.')
    }
  }

  return (
    <div style={{ margin: '2px 0 8px' }}>
      <button type="button" className="btn-add-soft" onClick={traer}>
        <span aria-hidden>⬇</span> Traer de MP (portapapeles)
      </button>
      {info && <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 5 }}>{info}</div>}
      {err && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 5 }}>{err}</div>}
    </div>
  )
}

function FirmaApertura({
  turno,
  onFirmado
}: {
  turno: Turno | null
  onFirmado: (t: Turno) => void
}): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!turno?.id) {
    return (
      <div className="banner warn" style={{ marginTop: 14 }}>
        Guardá el turno (borrador) para que el turno mañana pueda revisar la apertura y firmarla.
      </div>
    )
  }

  const fueModificada = turno.firmaLog.some((e) => e.accion === 'modificacion')

  if (turno.aprobadoPor) {
    return (
      <FirmaFirmada turno={turno} fueModificada={fueModificada} onFirmado={onFirmado} />
    )
  }

  async function firmar(): Promise<void> {
    setError('')
    const res = await window.api.firmarApertura(turno!.id, password)
    if (res.ok) onFirmado(res.data)
    else setError(res.error)
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Firma del turno mañana</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 10 }}>
        El responsable del turno mañana revisa la apertura y, si está correcta, la firma con su
        contraseña.
      </div>
      {fueModificada && (
        <div className="banner warn" style={{ marginBottom: 10 }}>
          La apertura fue habilitada para corregirla. Volvé a firmarla cuando esté correcta.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="text-input"
          style={{ maxWidth: 220 }}
          type="password"
          placeholder="Contraseña turno mañana"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') firmar()
          }}
        />
        <button className="btn btn-primary" onClick={firmar}>
          Validar y firmar
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

/** Vista cuando la apertura ya está firmada, con opción de modificarla (re-habilitar). */
function FirmaFirmada({
  turno,
  fueModificada,
  onFirmado
}: {
  turno: Turno
  fueModificada: boolean
  onFirmado: (t: Turno) => void
}): JSX.Element {
  const [modificando, setModificando] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function modificar(): Promise<void> {
    setError('')
    const res = await window.api.modificarFirma(turno.id, password)
    if (res.ok) {
      setModificando(false)
      setPassword('')
      onFirmado(res.data)
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="banner info" style={{ marginTop: 14 }}>
      <div>
        ✓ Apertura revisada y firmada por <b>{turno.aprobadoPorNombre}</b>
        {turno.aprobadoAt ? ` · ${fechaHora(turno.aprobadoAt)}` : ''}.
      </div>
      {fueModificada && (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Esta firma fue modificada (queda registrado para el administrador).
        </div>
      )}
      {!modificando ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => setModificando(true)}
        >
          Modificar firma
        </button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
            Si te confundiste, ingresá la contraseña del turno mañana para habilitar la apertura y
            corregirla. Después tenés que firmarla de nuevo.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="text-input"
              style={{ maxWidth: 220 }}
              type="password"
              placeholder="Contraseña turno mañana"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') modificar()
              }}
            />
            <button className="btn btn-primary" onClick={modificar}>
              Habilitar y corregir
            </button>
            <button
              className="btn"
              onClick={() => {
                setModificando(false)
                setPassword('')
                setError('')
              }}
            >
              Cancelar
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      )}
    </div>
  )
}
