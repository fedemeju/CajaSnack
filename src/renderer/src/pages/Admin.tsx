import { useEffect, useState } from 'react'
import type { BackupInfo, Rol, Turno, Usuario } from '../../../shared/types'
import { cuadreDeTurno, sumarMovimientos, entradasSalidas } from '../../../shared/calc'
import { fechaHora, fechaLinda, formatMoney, hoyISO } from '../lib/format'
import { exportarTurnoPDF, exportarCierreMensualPDF } from '../lib/pdf'
import { useConfirm } from '../components/Confirm'

function inicioMesISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}

function rolLabel(rol: string): string {
  if (rol === 'manana') return 'Turno Mañana'
  if (rol === 'tarde') return 'Turno Noche'
  return 'Administrador'
}

export function Admin({ user }: { user: Usuario }): JSX.Element {
  const [tab, setTab] = useState<
    'reportes' | 'estadisticas' | 'control' | 'cierre' | 'usuarios' | 'datos'
  >('reportes')
  const [aviso, setAviso] = useState<{ dias: number | null } | null>(null)

  useEffect(() => {
    window.api.estadoBackup(user.id).then((res) => {
      if (res.ok && (res.data.dias === null || res.data.dias >= 15)) {
        setAviso({ dias: res.data.dias })
      }
    })
  }, [user.id])

  return (
    <div>
      {aviso && (
        <RecordatorioBackup
          user={user}
          dias={aviso.dias}
          onCerrar={() => setAviso(null)}
          onIrADatos={() => {
            setAviso(null)
            setTab('datos')
          }}
        />
      )}
      <div className="page-title">
        <h1>Panel de Administración</h1>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'reportes' ? 'active' : ''}`} onClick={() => setTab('reportes')}>
          Reportes
        </button>
        <button
          className={`tab ${tab === 'estadisticas' ? 'active' : ''}`}
          onClick={() => setTab('estadisticas')}
        >
          Estadísticas
        </button>
        <button className={`tab ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}>
          Control
        </button>
        <button className={`tab ${tab === 'cierre' ? 'active' : ''}`} onClick={() => setTab('cierre')}>
          Cierre mensual
        </button>
        <button className={`tab ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}>
          Usuarios
        </button>
        <button className={`tab ${tab === 'datos' ? 'active' : ''}`} onClick={() => setTab('datos')}>
          Datos y backups
        </button>
      </div>
      {tab === 'reportes' && <Reportes user={user} />}
      {tab === 'estadisticas' && <Estadisticas user={user} />}
      {tab === 'control' && <Control user={user} />}
      {tab === 'cierre' && <CierreMensual user={user} />}
      {tab === 'usuarios' && <Usuarios user={user} />}
      {tab === 'datos' && <Datos user={user} />}
    </div>
  )
}

function resumen(t: Turno): { total: number; cuadra: boolean; dif: number } {
  const c = cuadreDeTurno(t)
  return { total: c.total, cuadra: c.cuadra, dif: c.diferencia }
}

function Reportes({ user }: { user: Usuario }): JSX.Element {
  const [desde, setDesde] = useState(inicioMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [error, setError] = useState('')

  function cargar(): void {
    window.api.listarTurnos(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setTurnos(res.data)
        setError('')
      } else setError(res.error)
    })
  }

  useEffect(cargar, [desde, hasta])

  const totalPeriodo = turnos.reduce((a, t) => a + resumen(t).total, 0)
  const sinCuadrar = turnos.filter((t) => !resumen(t).cuadra && t.estado === 'cerrado').length
  const mov = sumarMovimientos(turnos)
  const contadores = [
    { label: 'Ingresos Mercado Pago', value: mov.mercadoPago },
    { label: 'Ingresos Tarjetas', value: mov.tarjetas },
    { label: 'Ingresos Pedidos Ya', value: mov.pedidosYa },
    { label: 'Efectivo entregado', value: mov.efectivo },
    { label: 'Pagado a proveedores', value: mov.proveedores },
    { label: 'Otros gastos', value: mov.otrosGastos }
  ]

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body filters">
          <label className="filter">
            <span>Desde</span>
            <input className="text-input" style={{ width: 'auto' }} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="filter">
            <span>Hasta</span>
            <input className="text-input" style={{ width: 'auto' }} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Turnos</div>
              <div className="stat-value">{turnos.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total del período</div>
              <div className="stat-value">{formatMoney(totalPeriodo)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sin cuadrar</div>
              <div className="stat-value" style={{ color: sinCuadrar ? 'var(--bad)' : 'var(--ok)' }}>
                {sinCuadrar}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Movimientos del período</h2>
        <div className="card-body">
          <div className="counter-grid">
            {contadores.map((c) => (
              <div className="counter" key={c.label}>
                <div className="counter-label">{c.label}</div>
                <div className="counter-value">{formatMoney(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="report">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Turno</th>
            <th>Cajero</th>
            <th>Estado</th>
            <th className="num">Total</th>
            <th>Cuadre</th>
            <th className="acciones"></th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => {
            const r = resumen(t)
            return (
              <tr key={t.id}>
                <td>{fechaLinda(t.fecha)}</td>
                <td>{t.tipo === 'manana' ? 'Mañana' : 'Noche'}</td>
                <td>{t.usuarioNombre}</td>
                <td>
                  <span className={`pill ${t.estado}`}>{t.estado}</span>
                </td>
                <td className="num">{formatMoney(r.total)}</td>
                <td>
                  {r.cuadra ? (
                    <span style={{ color: 'var(--ok)' }}>✓ Cuadra</span>
                  ) : (
                    <span style={{ color: 'var(--bad)' }}>
                      {r.dif > 0 ? 'Falta ' : 'Sobra '}
                      {formatMoney(Math.abs(r.dif))}
                    </span>
                  )}
                </td>
                <td className="acciones">
                  <button className="btn" onClick={() => exportarTurnoPDF(t)}>
                    PDF
                  </button>
                </td>
              </tr>
            )
          })}
          {turnos.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                No hay turnos cargados en este período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]

function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function Delta({
  cur,
  prev,
  goodWhenUp
}: {
  cur: number
  prev?: number
  goodWhenUp: boolean
}): JSX.Element | null {
  if (prev === undefined) return null
  const diff = cur - prev
  if (diff === 0) return <span className="delta flat">— sin cambios</span>
  const up = diff > 0
  const good = up === goodWhenUp
  return (
    <span className={`delta ${good ? 'good' : 'bad'}`}>
      {up ? '▲' : '▼'} {formatMoney(Math.abs(diff))} vs. mes anterior
    </span>
  )
}

function Estadisticas({ user }: { user: Usuario }): JSX.Element {
  const now = new Date()
  const [anchor, setAnchor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [error, setError] = useState('')
  const [selIdx, setSelIdx] = useState(5)

  const window6: { y: number; m: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchor.y, anchor.m - i, 1)
    window6.push({ y: d.getFullYear(), m: d.getMonth() })
  }

  useEffect(() => {
    const first = window6[0]
    const desde = new Date(first.y, first.m, 1).toLocaleDateString('en-CA')
    const hasta = new Date(anchor.y, anchor.m + 1, 0).toLocaleDateString('en-CA')
    window.api.listarTurnos(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setTurnos(res.data)
        setError('')
      } else setError(res.error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.y, anchor.m, user.id])

  const datos = window6.map((mes) => {
    const key = monthKey(mes.y, mes.m)
    const ts = turnos.filter((t) => t.fecha.slice(0, 7) === key)
    const mov = sumarMovimientos(ts)
    const es = entradasSalidas(mov)
    return { ...mes, key, mov, ...es, turnos: ts.length }
  })

  const max = Math.max(1, ...datos.map((d) => Math.max(d.entradas, d.salidas)))
  const sel = datos[selIdx] ?? datos[5]
  const prev = datos[selIdx - 1]

  function mover(delta: number): void {
    const d = new Date(anchor.y, anchor.m + delta, 1)
    setAnchor({ y: d.getFullYear(), m: d.getMonth() })
    setSelIdx(5)
  }

  const entradasItems = [
    { label: 'Mercado Pago', value: sel.mov.mercadoPago },
    { label: 'Tarjetas', value: sel.mov.tarjetas },
    { label: 'Pedidos Ya', value: sel.mov.pedidosYa },
    { label: 'Efectivo', value: sel.mov.efectivo }
  ]
  const salidasItems = [
    { label: 'Proveedores', value: sel.mov.proveedores },
    { label: 'Otros gastos', value: sel.mov.otrosGastos }
  ]

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="chart-head">
          <button className="btn btn-ghost" onClick={() => mover(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <h2 style={{ margin: 0 }}>Entradas y salidas</h2>
          <button className="btn btn-ghost" onClick={() => mover(1)} aria-label="Mes siguiente">
            ›
          </button>
          <div className="chart-legend">
            <span className="legend-item">
              <i className="legend-dot in" /> Entradas
            </span>
            <span className="legend-item">
              <i className="legend-dot out" /> Salidas
            </span>
          </div>
        </div>
        <div className="card-body">
          <div className="chart">
            {datos.map((d, i) => (
              <button
                key={d.key}
                className={`chart-col ${i === selIdx ? 'active' : ''}`}
                onClick={() => setSelIdx(i)}
                title={`${MESES_LARGO[d.m]} ${d.y}`}
              >
                <div className="chart-up">
                  {d.entradas > 0 && (
                    <div
                      className="bar bar-in"
                      style={{ height: `max(${(d.entradas / max) * 100}%, 4px)` }}
                    />
                  )}
                </div>
                <div className="chart-zero" />
                <div className="chart-down">
                  {d.salidas > 0 && (
                    <div
                      className="bar bar-out"
                      style={{ height: `max(${(d.salidas / max) * 100}%, 4px)` }}
                    />
                  )}
                </div>
                <div className="chart-label">{MESES[d.m]}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Entradas — {MESES_LARGO[sel.m]}</div>
          <div className="summary-value in">{formatMoney(sel.entradas)}</div>
          <Delta cur={sel.entradas} prev={prev?.entradas} goodWhenUp />
        </div>
        <div className="summary-card">
          <div className="summary-label">Salidas — {MESES_LARGO[sel.m]}</div>
          <div className="summary-value out">{formatMoney(sel.salidas)}</div>
          <Delta cur={sel.salidas} prev={prev?.salidas} goodWhenUp={false} />
        </div>
        <div className="summary-card">
          <div className="summary-label">Balance — {MESES_LARGO[sel.m]}</div>
          <div className={`summary-value ${sel.balance >= 0 ? 'in' : 'out'}`}>
            {formatMoney(sel.balance)}
          </div>
          <Delta cur={sel.balance} prev={prev?.balance} goodWhenUp />
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Desglose de {MESES_LARGO[sel.m]} {sel.y} · {sel.turnos} turno{sel.turnos === 1 ? '' : 's'}
        </h2>
        <div className="card-body">
          <div className="desglose-group">
            <div className="desglose-title">
              <i className="legend-dot in" /> Entradas · {formatMoney(sel.entradas)}
            </div>
            <div className="counter-grid">
              {entradasItems.map((c) => (
                <div className="counter" key={c.label}>
                  <div className="counter-label">{c.label}</div>
                  <div className="counter-value in">{formatMoney(c.value)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="desglose-group" style={{ marginTop: 18 }}>
            <div className="desglose-title">
              <i className="legend-dot out" /> Salidas · {formatMoney(sel.salidas)}
            </div>
            <div className="counter-grid">
              {salidasItems.map((c) => (
                <div className="counter" key={c.label}>
                  <div className="counter-label">{c.label}</div>
                  <div className="counter-value out">{formatMoney(c.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function diasEntre(desde: string, hasta: string): string[] {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  const cur = new Date(y1, m1 - 1, d1)
  const end = new Date(y2, m2 - 1, d2)
  const out: string[] = []
  let guard = 0
  while (cur <= end && guard < 800) {
    out.push(cur.toLocaleDateString('en-CA'))
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return out
}

interface CajeroResumen {
  nombre: string
  turnos: number
  sinCuadrar: number
  falta: number
  sobra: number
  neto: number
}

function Control({ user }: { user: Usuario }): JSX.Element {
  const [desde, setDesde] = useState(inicioMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [umbral, setUmbral] = useState(5000)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [error, setError] = useState('')

  function cargar(): void {
    window.api.listarTurnos(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setTurnos(res.data)
        setError('')
      } else setError(res.error)
    })
  }

  useEffect(cargar, [desde, hasta])

  const cerrados = turnos.filter((t) => t.estado === 'cerrado')
  const abiertos = turnos.filter((t) => t.estado === 'abierto')

  const mapa = new Map<string, CajeroResumen>()
  for (const t of cerrados) {
    const c = cuadreDeTurno(t)
    const key = t.usuarioNombre || '—'
    const e = mapa.get(key) ?? { nombre: key, turnos: 0, sinCuadrar: 0, falta: 0, sobra: 0, neto: 0 }
    e.turnos++
    if (!c.cuadra) e.sinCuadrar++
    if (c.diferencia > 0) e.falta += c.diferencia
    else if (c.diferencia < 0) e.sobra += -c.diferencia
    e.neto += c.diferencia
    mapa.set(key, e)
  }
  const cajeros = [...mapa.values()].sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto))

  const presentes = new Set(turnos.map((t) => `${t.fecha}|${t.tipo}`))
  const huecos = diasEntre(desde, hasta)
    .map((f) => {
      const falta: string[] = []
      if (!presentes.has(`${f}|manana`)) falta.push('Mañana')
      if (!presentes.has(`${f}|noche`)) falta.push('Noche')
      return { fecha: f, falta }
    })
    .filter((h) => h.falta.length)

  const sobreUmbral = cerrados
    .filter((t) => Math.abs(cuadreDeTurno(t).diferencia) >= umbral)
    .sort((a, b) => Math.abs(cuadreDeTurno(b).diferencia) - Math.abs(cuadreDeTurno(a).diferencia))

  const firmasModificadas = turnos
    .filter((t) => t.tipo === 'noche' && t.firmaLog.some((e) => e.accion === 'modificacion'))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body filters">
          <label className="filter">
            <span>Desde</span>
            <input className="text-input" style={{ width: 'auto' }} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="filter">
            <span>Hasta</span>
            <input className="text-input" style={{ width: 'auto' }} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <label className="filter">
            <span>Umbral diferencia</span>
            <input
              className="text-input"
              style={{ width: 120 }}
              inputMode="numeric"
              value={umbral}
              onChange={(e) => setUmbral(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
            />
          </label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Pendientes y alertas</h2>
        <div className="card-body">
          {abiertos.length === 0 &&
            huecos.length === 0 &&
            sobreUmbral.length === 0 &&
            firmasModificadas.length === 0 && (
              <div className="banner info" style={{ margin: 0 }}>
                ✓ Sin pendientes en este período: no hay turnos sin cerrar, ni días sin cargar, ni
                diferencias por encima de {formatMoney(umbral)}, ni firmas modificadas.
              </div>
            )}

          {firmasModificadas.length > 0 && (
            <div style={{ marginBottom: abiertos.length || huecos.length || sobreUmbral.length ? 18 : 0 }}>
              <div className="desglose-title" style={{ color: 'var(--warn)' }}>
                Firmas de apertura modificadas ({firmasModificadas.length})
              </div>
              <table className="report" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Fecha (noche)</th>
                    <th>Estado actual</th>
                    <th>Historial de firma</th>
                  </tr>
                </thead>
                <tbody>
                  {firmasModificadas.map((t) => (
                    <tr key={t.id}>
                      <td>{fechaLinda(t.fecha)}</td>
                      <td>
                        {t.aprobadoPor ? (
                          <span style={{ color: 'var(--ok)' }}>Re-firmada</span>
                        ) : (
                          <span style={{ color: 'var(--warn)' }}>Pendiente de re-firma</span>
                        )}
                      </td>
                      <td>
                        {t.firmaLog.map((e, i) => (
                          <div key={i}>
                            {e.accion === 'firma' ? 'Firmada' : 'Modificada'} {fechaHora(e.at)} ·{' '}
                            {e.firmante}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {abiertos.length > 0 && (
            <div style={{ marginBottom: huecos.length || sobreUmbral.length ? 18 : 0 }}>
              <div className="desglose-title" style={{ color: 'var(--warn)' }}>
                Turnos sin cerrar ({abiertos.length})
              </div>
              <table className="report" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Cajero</th>
                  </tr>
                </thead>
                <tbody>
                  {abiertos.map((t) => (
                    <tr key={t.id}>
                      <td>{fechaLinda(t.fecha)}</td>
                      <td>{t.tipo === 'manana' ? 'Mañana' : 'Noche'}</td>
                      <td>{t.usuarioNombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {huecos.length > 0 && (
            <div style={{ marginBottom: sobreUmbral.length ? 18 : 0 }}>
              <div className="desglose-title" style={{ color: 'var(--warn)' }}>
                Días sin turno cargado ({huecos.length})
              </div>
              <table className="report" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Falta cargar</th>
                  </tr>
                </thead>
                <tbody>
                  {huecos.map((h) => (
                    <tr key={h.fecha}>
                      <td>{fechaLinda(h.fecha)}</td>
                      <td>{h.falta.join(' y ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sobreUmbral.length > 0 && (
            <div>
              <div className="desglose-title" style={{ color: 'var(--bad)' }}>
                Diferencias mayores a {formatMoney(umbral)} ({sobreUmbral.length})
              </div>
              <table className="report" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Cajero</th>
                    <th className="num">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {sobreUmbral.map((t) => {
                    const c = cuadreDeTurno(t)
                    return (
                      <tr key={t.id}>
                        <td>{fechaLinda(t.fecha)}</td>
                        <td>{t.tipo === 'manana' ? 'Mañana' : 'Noche'}</td>
                        <td>{t.usuarioNombre}</td>
                        <td className="num" style={{ color: 'var(--bad)' }}>
                          {c.diferencia > 0 ? 'Falta ' : 'Sobra '}
                          {formatMoney(Math.abs(c.diferencia))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Diferencias por cajero (turnos cerrados)</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Cajero</th>
                <th className="num">Turnos</th>
                <th className="num">Sin cuadrar</th>
                <th className="num">Faltantes</th>
                <th className="num">Sobrantes</th>
                <th className="num">Neto</th>
              </tr>
            </thead>
            <tbody>
              {cajeros.map((c) => (
                <tr key={c.nombre}>
                  <td>{c.nombre}</td>
                  <td className="num">{c.turnos}</td>
                  <td className="num" style={{ color: c.sinCuadrar ? 'var(--bad)' : 'var(--ok)' }}>
                    {c.sinCuadrar}
                  </td>
                  <td className="num">{c.falta ? formatMoney(c.falta) : '—'}</td>
                  <td className="num">{c.sobra ? formatMoney(c.sobra) : '—'}</td>
                  <td className="num" style={{ color: c.neto > 0 ? 'var(--bad)' : c.neto < 0 ? 'var(--warn)' : 'var(--ok)' }}>
                    {c.neto === 0 ? '✓ 0' : (c.neto > 0 ? 'Falta ' : 'Sobra ') + formatMoney(Math.abs(c.neto))}
                  </td>
                </tr>
              ))}
              {cajeros.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    No hay turnos cerrados en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MedioFila({
  label,
  value,
  total,
  tono
}: {
  label: string
  value: number
  total: number
  tono?: 'in' | 'out'
}): JSX.Element {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="medio-fila">
      <div className="medio-cabecera">
        <span>{label}</span>
        <span className={tono ? `summary-value ${tono}` : ''} style={{ fontWeight: 700 }}>
          {formatMoney(value)}
        </span>
      </div>
      <div className="medio-barra">
        <div className={`medio-relleno ${tono ?? 'in'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="medio-pct">{pct}% del total cobrado</div>
    </div>
  )
}

function CierreMensual({ user }: { user: Usuario }): JSX.Element {
  const now = new Date()
  const [anchor, setAnchor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const desde = new Date(anchor.y, anchor.m, 1).toLocaleDateString('en-CA')
    const hasta = new Date(anchor.y, anchor.m + 1, 0).toLocaleDateString('en-CA')
    window.api.listarTurnos(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setTurnos(res.data)
        setError('')
      } else setError(res.error)
    })
  }, [anchor.y, anchor.m, user.id])

  function mover(delta: number): void {
    const d = new Date(anchor.y, anchor.m + delta, 1)
    setAnchor({ y: d.getFullYear(), m: d.getMonth() })
  }

  const cerrados = turnos.filter((t) => t.estado === 'cerrado')
  const abiertos = turnos.length - cerrados.length
  const totalCaja = turnos.reduce((a, t) => a + cuadreDeTurno(t).total, 0)
  let falta = 0
  let sobra = 0
  let neto = 0
  let sinCuadrar = 0
  for (const t of cerrados) {
    const c = cuadreDeTurno(t)
    if (!c.cuadra) sinCuadrar++
    if (c.diferencia > 0) falta += c.diferencia
    else if (c.diferencia < 0) sobra += -c.diferencia
    neto += c.diferencia
  }

  const mov = sumarMovimientos(turnos)
  const electronico = mov.tarjetas + mov.mercadoPago + mov.transferencias + mov.pedidosYa
  const cobrado = electronico + mov.efectivo
  const mesLabel = MESES_LARGO[anchor.m]

  function exportar(): void {
    exportarCierreMensualPDF({
      mesLabel,
      anio: anchor.y,
      turnos: turnos.length,
      cerrados: cerrados.length,
      abiertos,
      totalCaja,
      falta,
      sobra,
      neto,
      sinCuadrar,
      mov
    })
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="chart-head">
          <button className="btn btn-ghost" onClick={() => mover(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <h2 style={{ margin: 0 }}>
            Cierre de {mesLabel} {anchor.y}
          </h2>
          <button className="btn btn-ghost" onClick={() => mover(1)} aria-label="Mes siguiente">
            ›
          </button>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={exportar} disabled={turnos.length === 0}>
            Exportar cierre (PDF)
          </button>
        </div>
        <div className="card-body">
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Turnos del mes</div>
              <div className="stat-value">{turnos.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total de caja</div>
              <div className="stat-value">{formatMoney(totalCaja)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sin cerrar</div>
              <div className="stat-value" style={{ color: abiertos ? 'var(--warn)' : 'var(--ok)' }}>
                {abiertos}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Turnos sin cuadrar</div>
              <div className="stat-value" style={{ color: sinCuadrar ? 'var(--bad)' : 'var(--ok)' }}>
                {sinCuadrar}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Faltantes acumulados</div>
          <div className="summary-value out">{formatMoney(falta)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Sobrantes acumulados</div>
          <div className="summary-value in">{formatMoney(sobra)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Diferencia neta</div>
          <div className={`summary-value ${neto > 0 ? 'out' : 'in'}`}>
            {neto === 0 ? '✓ Cuadra' : (neto > 0 ? 'Falta ' : 'Sobra ') + formatMoney(Math.abs(neto))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Conciliación por medio de cobro</h2>
        <div className="card-body">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Total cobrado en el mes: <b>{formatMoney(cobrado)}</b>. Lo electrónico (
            {cobrado > 0 ? Math.round((electronico / cobrado) * 100) : 0}%) es lo que tenés que cruzar
            contra el banco; el efectivo ({cobrado > 0 ? Math.round((mov.efectivo / cobrado) * 100) : 0}
            %) es lo que queda en caja.
          </p>
          <MedioFila label="Efectivo" value={mov.efectivo} total={cobrado} tono="in" />
          <MedioFila label="Tarjetas" value={mov.tarjetas} total={cobrado} tono="in" />
          <MedioFila label="Mercado Pago" value={mov.mercadoPago} total={cobrado} tono="in" />
          <MedioFila label="Transferencias" value={mov.transferencias} total={cobrado} tono="in" />
          <MedioFila label="Pedidos Ya" value={mov.pedidosYa} total={cobrado} tono="in" />

          <div className="desglose-group" style={{ marginTop: 18 }}>
            <div className="desglose-title">
              <i className="legend-dot out" /> Salidas del mes
            </div>
            <div className="counter-grid">
              <div className="counter">
                <div className="counter-label">Proveedores</div>
                <div className="counter-value out">{formatMoney(mov.proveedores)}</div>
              </div>
              <div className="counter">
                <div className="counter-label">Otros gastos</div>
                <div className="counter-value out">{formatMoney(mov.otrosGastos)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Usuarios({ user }: { user: Usuario }): JSX.Element {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [msg, setMsg] = useState('')
  const [target, setTarget] = useState<Usuario | null>(null)
  const [nuevo, setNuevo] = useState(false)

  function cargar(): void {
    window.api.listarUsuarios(user.id).then((res) => {
      if (res.ok) setUsuarios(res.data)
    })
  }

  useEffect(cargar, [user.id])

  function aviso(texto: string): void {
    setMsg(texto)
    setTimeout(() => setMsg(''), 3000)
  }

  function onGuardado(nombre: string): void {
    aviso(`Contraseña actualizada para ${nombre}.`)
  }

  return (
    <div>
      {msg && <div className="banner info">{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => setNuevo(true)}>
          + Nuevo usuario
        </button>
      </div>
      <table className="report">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th className="acciones"></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.usuario}</td>
              <td>{u.nombre}</td>
              <td>
                <span className="pill neutral">{rolLabel(u.rol)}</span>
              </td>
              <td className="acciones">
                <button className="btn" onClick={() => setTarget(u)}>
                  Cambiar contraseña
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {target && (
        <CambiarPassword
          actorId={user.id}
          target={target}
          onClose={() => setTarget(null)}
          onGuardado={onGuardado}
        />
      )}

      {nuevo && (
        <NuevoUsuario
          actorId={user.id}
          onClose={() => setNuevo(false)}
          onCreado={(nombre) => {
            setNuevo(false)
            aviso(`Usuario "${nombre}" creado.`)
            cargar()
          }}
        />
      )}
    </div>
  )
}

function NuevoUsuario({
  actorId,
  onClose,
  onCreado
}: {
  actorId: number
  onClose: () => void
  onCreado: (nombre: string) => void
}): JSX.Element {
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('manana')
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(): Promise<void> {
    setError('')
    if (!usuario.trim()) return setError('Ingresá el nombre de usuario (para entrar).')
    if (!nombre.trim()) return setError('Ingresá el nombre visible.')
    if (pass1.length < 4) return setError('La contraseña debe tener al menos 4 caracteres.')
    if (pass1 !== pass2) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const res = await window.api.crearUsuario(actorId, usuario.trim(), nombre.trim(), rol, pass1)
    setGuardando(false)
    if (res.ok) onCreado(res.data.nombre)
    else setError(res.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo usuario</h3>

        <label className="modal-label">Usuario (para iniciar sesión)</label>
        <input
          className="text-input"
          autoFocus
          placeholder="ej. mozo1"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />

        <label className="modal-label">Nombre visible</label>
        <input
          className="text-input"
          placeholder="ej. Turno Mañana"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <label className="modal-label">Rol</label>
        <select className="text-input" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="manana">Turno Mañana</option>
          <option value="tarde">Turno Noche</option>
          <option value="admin">Administrador</option>
        </select>

        <label className="modal-label">Contraseña</label>
        <input
          className="text-input"
          type="password"
          value={pass1}
          onChange={(e) => setPass1(e.target.value)}
        />

        <label className="modal-label">Repetir contraseña</label>
        <input
          className="text-input"
          type="password"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CambiarPassword({
  actorId,
  target,
  onClose,
  onGuardado
}: {
  actorId: number
  target: Usuario
  onClose: () => void
  onGuardado: (nombre: string) => void
}): JSX.Element {
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(): Promise<void> {
    setError('')
    if (pass1.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.')
      return
    }
    if (pass1 !== pass2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setGuardando(true)
    const res = await window.api.cambiarPassword(actorId, target.id, pass1)
    setGuardando(false)
    if (res.ok) {
      onGuardado(target.nombre)
      onClose()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cambiar contraseña</h3>
        <p className="modal-sub">
          Usuario: <b>{target.nombre}</b> ({target.usuario})
        </p>

        <label className="modal-label">Nueva contraseña</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={pass1}
          onChange={(e) => setPass1(e.target.value)}
        />

        <label className="modal-label">Repetir contraseña</label>
        <input
          className="text-input"
          type="password"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fechaHoraLinda(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function tamanoLindo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function etiquetaBackup(nombre: string): string {
  if (nombre.includes('antes_de_restaurar')) return 'Pre-restauración'
  if (nombre.includes('diario')) return 'Diaria'
  if (/turno\d+/.test(nombre)) return 'Cierre de turno'
  return 'Copia'
}

function RecordatorioBackup({
  user,
  dias,
  onCerrar,
  onIrADatos
}: {
  user: Usuario
  dias: number | null
  onCerrar: () => void
  onIrADatos: () => void
}): JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  const texto =
    dias === null
      ? 'Todavía no guardaste ninguna copia de seguridad fuera de la app.'
      : `Hace ${dias} día${dias === 1 ? '' : 's'} que no guardás una copia de seguridad.`

  async function exportar(): Promise<void> {
    setError('')
    setOcupado(true)
    const res = await window.api.exportarCopia(user.id)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    if (res.data) setListo(true)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Recordatorio de copia de seguridad</h3>
        {listo ? (
          <>
            <p className="confirm-msg">
              Copia guardada correctamente. Guardala en un pendrive o en Google Drive para tenerla fuera
              de esta PC.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onCerrar}>
                Listo
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="confirm-msg">
              {texto} Conviene guardar una copia fuera de la PC (pendrive o Google Drive) por si se rompe el
              disco. ¿Querés guardar una copia ahora?
            </p>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={onCerrar} disabled={ocupado}>
                Más tarde
              </button>
              <button className="btn" onClick={onIrADatos} disabled={ocupado}>
                Ver opciones
              </button>
              <button className="btn btn-primary" onClick={exportar} disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Exportar copia ahora'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Datos({ user }: { user: Usuario }): JSX.Element {
  const confirm = useConfirm()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [borrar, setBorrar] = useState(false)

  function cargar(): void {
    window.api.listarBackups(user.id).then((res) => {
      if (res.ok) setBackups(res.data)
      else setError(res.error)
    })
  }

  useEffect(cargar, [user.id])

  function aviso(texto: string): void {
    setMsg(texto)
    setError('')
    setTimeout(() => setMsg(''), 5000)
  }

  async function exportarCopia(): Promise<void> {
    setOcupado(true)
    const res = await window.api.exportarCopia(user.id)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    if (res.data) {
      aviso(`Copia guardada en: ${res.data}`)
      cargar()
    }
  }

  async function exportarLegible(): Promise<void> {
    setOcupado(true)
    const res = await window.api.exportarLegible(user.id)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    if (res.data) aviso(`Datos exportados a: ${res.data}`)
  }

  async function abrirCarpeta(): Promise<void> {
    const res = await window.api.abrirCarpetaBackups(user.id)
    if (!res.ok) setError(res.error)
  }

  async function restaurar(nombre: string): Promise<void> {
    const ok = await confirm({
      mensaje:
        'Esto reemplazará TODOS los datos actuales por los de la copia seleccionada.\n\n' +
        'Se guardará un resguardo de los datos actuales por las dudas. La app se va a recargar.\n\n' +
        '¿Restaurar esta copia?',
      confirmar: 'Restaurar',
      peligro: true
    })
    if (!ok) return
    setOcupado(true)
    const res = await window.api.restaurarBackup(user.id, nombre)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    aviso('Copia restaurada. Recargando…')
    setTimeout(() => window.location.reload(), 1500)
  }

  async function restaurarArchivo(): Promise<void> {
    const ok = await confirm({
      mensaje:
        'Vas a elegir un archivo de copia (.enc) para reemplazar TODOS los datos actuales.\n\n' +
        'Se guardará un resguardo de los datos actuales. La app se va a recargar.\n\n' +
        '¿Continuar?',
      confirmar: 'Elegir archivo',
      peligro: true
    })
    if (!ok) return
    setOcupado(true)
    const res = await window.api.restaurarArchivo(user.id)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    if (res.data) {
      aviso('Copia restaurada. Recargando…')
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  return (
    <div>
      {msg && <div className="banner info">{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Copias de seguridad</h2>
        <div className="card-body">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            La app guarda una copia automática <b>todos los días</b> y <b>cada vez que se cierra un turno</b>.
            Aun así, conviene guardar una copia fuera de la PC (pendrive o Google Drive) cada tanto, por si se
            rompe el disco.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-primary" onClick={exportarCopia} disabled={ocupado}>
              Exportar copia ahora
            </button>
            <button className="btn" onClick={exportarLegible} disabled={ocupado}>
              Exportar para Excel (CSV)
            </button>
            <button className="btn" onClick={abrirCarpeta}>
              Abrir carpeta de copias
            </button>
            <button className="btn" onClick={restaurarArchivo} disabled={ocupado}>
              Restaurar desde archivo…
            </button>
          </div>
          <div className="banner warn" style={{ marginTop: 14, marginBottom: 0 }}>
            <b>Importante:</b> la copia cifrada (.enc) solo se puede restaurar en <b>esta misma PC</b>. La
            exportación a Excel es texto plano y se puede abrir siempre, en cualquier lado.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Copias guardadas en esta PC ({backups.length})</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="num">Tamaño</th>
                <th className="acciones"></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.nombre}>
                  <td>{fechaHoraLinda(b.fecha)}</td>
                  <td>
                    <span className="pill neutral">{etiquetaBackup(b.nombre)}</span>
                  </td>
                  <td className="num">{tamanoLindo(b.tamano)}</td>
                  <td className="acciones">
                    <button className="btn" onClick={() => restaurar(b.nombre)} disabled={ocupado}>
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    Todavía no hay copias guardadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, borderColor: 'var(--bad-border, #f0c4c4)' }}>
        <h2 style={{ color: 'var(--bad)' }}>Borrar todos los turnos</h2>
        <div className="card-body">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Elimina <b>todos los turnos cargados</b> (por ejemplo, los de prueba). Los usuarios y sus
            contraseñas se conservan. Antes de borrar se guarda una copia de seguridad automática por las
            dudas. Esta acción no se puede deshacer salvo restaurando esa copia.
          </p>
          <button className="btn btn-danger" onClick={() => setBorrar(true)} disabled={ocupado}>
            Borrar todos los turnos…
          </button>
        </div>
      </div>

      {borrar && (
        <BorrarTurnos
          actorId={user.id}
          onClose={() => setBorrar(false)}
          onBorrado={(n) => {
            setBorrar(false)
            aviso(`Se borraron ${n} turno${n === 1 ? '' : 's'}. Recargando…`)
            setTimeout(() => window.location.reload(), 1500)
          }}
        />
      )}
    </div>
  )
}

function BorrarTurnos({
  actorId,
  onClose,
  onBorrado
}: {
  actorId: number
  onClose: () => void
  onBorrado: (n: number) => void
}): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function confirmar(): Promise<void> {
    setError('')
    if (!password) {
      setError('Ingresá tu contraseña de administrador.')
      return
    }
    setOcupado(true)
    const res = await window.api.borrarTurnos(actorId, password)
    setOcupado(false)
    if (res.ok) onBorrado(res.data)
    else setError(res.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: 'var(--bad)' }}>Borrar todos los turnos</h3>
        <p className="confirm-msg">
          Vas a borrar <b>todos los turnos cargados</b>. Se guardará una copia de seguridad antes. Para
          confirmar, ingresá tu contraseña de administrador.
        </p>

        <label className="modal-label">Contraseña de administrador</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={confirmar} disabled={ocupado}>
            {ocupado ? 'Borrando…' : 'Borrar turnos'}
          </button>
        </div>
      </div>
    </div>
  )
}
