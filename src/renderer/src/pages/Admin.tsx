import { useEffect, useState } from 'react'
import type {
  BackupInfo,
  EstadoBackup,
  EstadoMail,
  EstadoNube,
  EstadoSeguridad,
  RegistroAuditoria,
  Rol,
  Turno,
  Usuario
} from '../../../shared/types'
import {
  cuadreDeTurno,
  sumarMovimientos,
  entradasSalidas,
  bowlingDeTurno,
  sumarRubros,
  sumarAgasajos
} from '../../../shared/calc'
import { fechaHora, fechaLinda, formatMoney, hoyISO } from '../lib/format'
import { exportarTurnoPDF, exportarCierreMensualPDF } from '../lib/pdf'
import { useConfirm } from '../components/Confirm'
import { Logo } from '../components/Logo'
import { DetalleTurno } from '../components/DetalleTurno'
import logoCuadrado from '../assets/logo-cuadrado.png'

function inicioMesISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}

function rolLabel(rol: string): string {
  if (rol === 'manana') return 'Turno Mañana'
  if (rol === 'tarde') return 'Turno Noche'
  return 'Administrador'
}

type AdminTab =
  | 'inicio'
  | 'reportes'
  | 'comparar'
  | 'bowling'
  | 'mozos'
  | 'control'
  | 'actividad'
  | 'cierre'
  | 'usuarios'
  | 'datos'

interface NavDef {
  id: AdminTab
  icon: string
  label: string
}

const NAV_GRUPOS: { titulo: string; items: NavDef[] }[] = [
  {
    titulo: 'Análisis',
    items: [
      { id: 'comparar', icon: '⇄', label: 'Comparar' },
      { id: 'bowling', icon: '🎳', label: 'Bowling' },
      { id: 'mozos', icon: '🧑‍🍳', label: 'Mozos' }
    ]
  },
  {
    titulo: 'Control',
    items: [
      { id: 'control', icon: '⚠', label: 'Control' },
      { id: 'actividad', icon: '📋', label: 'Actividad' }
    ]
  },
  {
    titulo: 'Cierres',
    items: [{ id: 'cierre', icon: '🗓', label: 'Cierre mensual' }]
  },
  {
    titulo: 'Administración',
    items: [
      { id: 'usuarios', icon: '👥', label: 'Usuarios' },
      { id: 'datos', icon: '💾', label: 'Datos y backups' }
    ]
  }
]

export function Admin({
  user,
  onLogout,
  themeToggle
}: {
  user: Usuario
  onLogout: () => void
  themeToggle: JSX.Element
}): JSX.Element {
  const [tab, setTab] = useState<AdminTab>('inicio')
  const [aviso, setAviso] = useState<{ dias: number | null } | null>(null)
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem('admin-sidebar-colapsado') !== 'false'
  )
  const [fijado, setFijado] = useState(
    () => localStorage.getItem('admin-sidebar-fijado') === 'true'
  )

  useEffect(() => {
    window.api.estadoBackup(user.id).then((res) => {
      if (res.ok && (res.data.dias === null || res.data.dias >= 15)) {
        setAviso({ dias: res.data.dias })
      }
    })
  }, [user.id])

  function toggleColapsado(): void {
    if (fijado) return // con la barra fijada no se cambia por accidente
    setColapsado((prev) => {
      const next = !prev
      localStorage.setItem('admin-sidebar-colapsado', String(next))
      return next
    })
  }

  function toggleFijado(): void {
    setFijado((prev) => {
      const next = !prev
      localStorage.setItem('admin-sidebar-fijado', String(next))
      return next
    })
  }

  function NavItem({ id, icon, label }: NavDef): JSX.Element {
    return (
      <button
        className={`sidebar-item ${tab === id ? 'active' : ''}`}
        onClick={() => setTab(id)}
        title={colapsado ? label : undefined}
      >
        <span className="sidebar-icon">{icon}</span>
        <span className="sidebar-label">{label}</span>
      </button>
    )
  }

  return (
    <div className={`admin-app ${colapsado ? 'colapsado' : ''}`}>
      <aside className="admin-rail">
        <div className="rail-brand">
          <Logo className="rail-logo-full" />
          <img className="rail-logo-mini" src={logoCuadrado} alt="Caja Snack" />
        </div>

        <button
          className="sidebar-toggle"
          onClick={toggleColapsado}
          disabled={fijado}
          title={
            fijado
              ? 'Barra fijada — desbloqueá abajo para cambiar'
              : colapsado
                ? 'Expandir menú'
                : 'Contraer menú'
          }
          aria-label="Expandir o contraer menú"
        >
          <span className="sidebar-icon">{colapsado ? '☰' : '«'}</span>
          <span className="sidebar-label">Contraer</span>
        </button>

        <nav className="sidebar-nav">
          <NavItem id="inicio" icon="📈" label="Estadísticas" />
          <NavItem id="reportes" icon="📊" label="Reportes" />

          {NAV_GRUPOS.map((g) => (
            <div className="sidebar-group" key={g.titulo}>
              <div className="sidebar-group-title">{g.titulo}</div>
              {g.items.map((it) => (
                <NavItem key={it.id} {...it} />
              ))}
            </div>
          ))}
        </nav>

        <button
          className={`rail-lock ${fijado ? 'on' : ''}`}
          onClick={toggleFijado}
          title={
            fijado ? 'Posición fijada (clic para desbloquear)' : 'Fijar la posición de la barra'
          }
          aria-label={fijado ? 'Desbloquear barra' : 'Fijar barra'}
        >
          <span className="sidebar-icon">{fijado ? '🔒' : '🔓'}</span>
          <span className="sidebar-label">{fijado ? 'Posición fijada' : 'Fijar posición'}</span>
        </button>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-right">
            <span className="role-tag">{rolLabel(user.rol)}</span>
            {themeToggle}
            <button className="btn btn-danger" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="admin-scroll">
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
          {tab === 'inicio' && <Estadisticas user={user} />}
          {tab === 'reportes' && <Reportes user={user} />}
          {tab === 'comparar' && <Comparar user={user} />}
          {tab === 'bowling' && <Bowling user={user} />}
          {tab === 'mozos' && <Mozos user={user} />}
          {tab === 'control' && <Control user={user} />}
          {tab === 'actividad' && <Actividad user={user} />}
          {tab === 'cierre' && <CierreMensual user={user} />}
          {tab === 'usuarios' && <Usuarios user={user} />}
          {tab === 'datos' && <Datos user={user} />}
        </div>
      </div>
    </div>
  )
}

function resumen(t: Turno): { total: number; cuadra: boolean; dif: number } {
  const c = cuadreDeTurno(t)
  return { total: c.total, cuadra: c.cuadra, dif: c.diferencia }
}

function DeltaDash({
  actual,
  previo,
  etiqueta
}: {
  actual: number
  previo: number
  etiqueta: string
}): JSX.Element {
  const diff = actual - previo
  if (actual === 0 && previo === 0) return <span className="delta flat">— sin datos {etiqueta}</span>
  if (diff === 0) return <span className="delta flat">— igual {etiqueta}</span>
  const up = diff > 0
  const pct = previo > 0 ? Math.round((diff / previo) * 100) : null
  return (
    <span className={`delta ${up ? 'good' : 'bad'}`}>
      {up ? '▲' : '▼'} {formatMoney(Math.abs(diff))}
      {pct !== null ? ` (${up ? '+' : '−'}${Math.abs(pct)}%)` : ''} {etiqueta}
    </span>
  )
}

function Inicio({ user }: { user: Usuario }): JSX.Element {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [backup, setBackup] = useState<EstadoBackup | null>(null)
  const [verTurno, setVerTurno] = useState<Turno | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const now = new Date()
    const desde = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA')
    window.api.listarTurnos(user.id, desde, hoyISO()).then((r) => {
      if (r.ok) setTurnos(r.data)
      else setError(r.error)
    })
    window.api.estadoBackup(user.id).then((r) => {
      if (r.ok) setBackup(r.data)
    })
  }, [user.id])

  const hoy = hoyISO()
  const offDate = (off: number): string => {
    const x = new Date()
    x.setDate(x.getDate() + off)
    return x.toLocaleDateString('en-CA')
  }
  const totalEntre = (desde: string, hasta: string): number =>
    turnos
      .filter((t) => t.fecha >= desde && t.fecha <= hasta)
      .reduce((a, t) => a + cuadreDeTurno(t).total, 0)
  const totalDia = (f: string): number =>
    turnos.filter((t) => t.fecha === f).reduce((a, t) => a + cuadreDeTurno(t).total, 0)
  const totalMes = (key: string): number =>
    turnos.filter((t) => t.fecha.slice(0, 7) === key).reduce((a, t) => a + cuadreDeTurno(t).total, 0)

  const now = new Date()
  const mesKey = hoy.slice(0, 7)
  const prevMes = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesPrevKey = `${prevMes.getFullYear()}-${String(prevMes.getMonth() + 1).padStart(2, '0')}`

  const hoyTotal = totalDia(hoy)
  const ayerTotal = totalDia(offDate(-1))
  const sem = totalEntre(offDate(-6), hoy)
  const semPrev = totalEntre(offDate(-13), offDate(-7))
  const mes = totalMes(mesKey)
  const mesPrev = totalMes(mesPrevKey)

  const abiertos = turnos.filter((t) => t.estado === 'abierto')
  const mesT = turnos.filter((t) => t.fecha.slice(0, 7) === mesKey)
  const sinCuadrar = mesT.filter((t) => t.estado === 'cerrado' && !cuadreDeTurno(t).cuadra).length
  const recientes = [...turnos]
    .sort((a, b) => (a.fecha === b.fecha ? b.tipo.localeCompare(a.tipo) : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 6)
  const backupViejo = backup?.dias != null && backup.dias >= 15
  const sinPendientes = abiertos.length === 0 && sinCuadrar === 0 && !backupViejo

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Hoy</div>
          <div className="summary-value in">{formatMoney(hoyTotal)}</div>
          <DeltaDash actual={hoyTotal} previo={ayerTotal} etiqueta="vs ayer" />
        </div>
        <div className="summary-card">
          <div className="summary-label">Últimos 7 días</div>
          <div className="summary-value in">{formatMoney(sem)}</div>
          <DeltaDash actual={sem} previo={semPrev} etiqueta="vs 7 días previos" />
        </div>
        <div className="summary-card">
          <div className="summary-label">Este mes</div>
          <div className="summary-value in">{formatMoney(mes)}</div>
          <DeltaDash actual={mes} previo={mesPrev} etiqueta="vs mes pasado" />
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Pendientes y estado</h2>
        <div className="card-body">
          {sinPendientes && (
            <div className="banner info" style={{ marginTop: 0 }}>
              ✓ Todo al día: sin turnos abiertos, sin descuadres este mes y la copia de seguridad
              reciente.
            </div>
          )}
          <div className="counter-grid">
            <div className="counter">
              <div className="counter-label">Turnos sin cerrar</div>
              <div
                className="counter-value"
                style={{ color: abiertos.length ? 'var(--warn)' : 'var(--ok)' }}
              >
                {abiertos.length}
              </div>
            </div>
            <div className="counter">
              <div className="counter-label">Sin cuadrar (este mes)</div>
              <div
                className="counter-value"
                style={{ color: sinCuadrar ? 'var(--bad)' : 'var(--ok)' }}
              >
                {sinCuadrar}
              </div>
            </div>
            <div className="counter">
              <div className="counter-label">Última copia de seguridad</div>
              <div className="counter-value" style={{ color: backupViejo ? 'var(--warn)' : 'var(--ok)' }}>
                {backup?.dias == null ? 'Nunca' : backup.dias === 0 ? 'Hoy' : `Hace ${backup.dias} d`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Últimos turnos</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Estado</th>
                <th className="num">Total</th>
                <th>Cuadre</th>
                <th className="acciones"></th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((t) => {
                const c = cuadreDeTurno(t)
                return (
                  <tr key={t.id}>
                    <td>{fechaLinda(t.fecha)}</td>
                    <td>{t.tipo === 'manana' ? 'Mañana' : 'Noche'}</td>
                    <td>
                      <span className={`pill ${t.estado}`}>{t.estado}</span>
                    </td>
                    <td className="num">{formatMoney(c.total)}</td>
                    <td>
                      {c.cuadra ? (
                        <span style={{ color: 'var(--ok)' }}>✓ Cuadra</span>
                      ) : (
                        <span style={{ color: c.diferencia > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                          {c.diferencia > 0 ? 'Falta ' : 'Sobra '}
                          {formatMoney(Math.abs(c.diferencia))}
                        </span>
                      )}
                    </td>
                    <td className="acciones">
                      <button className="btn" onClick={() => setVerTurno(t)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
              {recientes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    Todavía no hay turnos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {verTurno && <DetalleTurno turno={verTurno} onClose={() => setVerTurno(null)} />}
    </div>
  )
}

function Reportes({ user }: { user: Usuario }): JSX.Element {
  const [desde, setDesde] = useState(inicioMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'manana' | 'noche'>('todos')
  const [turnosRaw, setTurnosRaw] = useState<Turno[]>([])
  const [verTurno, setVerTurno] = useState<Turno | null>(null)
  const [error, setError] = useState('')

  function cargar(): void {
    window.api.listarTurnos(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setTurnosRaw(res.data)
        setError('')
      } else setError(res.error)
    })
  }

  useEffect(cargar, [desde, hasta])

  const turnos =
    tipoFiltro === 'todos' ? turnosRaw : turnosRaw.filter((t) => t.tipo === tipoFiltro)

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
          <label className="filter">
            <span>Turno</span>
            <div className="seg">
              <button
                className={`seg-btn ${tipoFiltro === 'todos' ? 'active' : ''}`}
                onClick={() => setTipoFiltro('todos')}
              >
                Todos
              </button>
              <button
                className={`seg-btn ${tipoFiltro === 'manana' ? 'active' : ''}`}
                onClick={() => setTipoFiltro('manana')}
              >
                Mañana
              </button>
              <button
                className={`seg-btn ${tipoFiltro === 'noche' ? 'active' : ''}`}
                onClick={() => setTipoFiltro('noche')}
              >
                Noche
              </button>
            </div>
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
                <td>
                  {t.usuarioNombre}
                  {(t.data as { cerradoPor?: string }).cerradoPor && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      cerró: {(t.data as { cerradoPor?: string }).cerradoPor}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`pill ${t.estado}`}>{t.estado}</span>
                </td>
                <td className="num">{formatMoney(r.total)}</td>
                <td>
                  {r.cuadra ? (
                    <span style={{ color: 'var(--ok)' }}>✓ Cuadra</span>
                  ) : (
                    <span style={{ color: r.dif > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                      {r.dif > 0 ? 'Falta ' : 'Sobra '}
                      {formatMoney(Math.abs(r.dif))}
                    </span>
                  )}
                </td>
                <td className="acciones">
                  <button className="btn" onClick={() => setVerTurno(t)}>
                    Ver
                  </button>
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

      {verTurno && <DetalleTurno turno={verTurno} onClose={() => setVerTurno(null)} />}
    </div>
  )
}

function Actividad({ user }: { user: Usuario }): JSX.Element {
  const [desde, setDesde] = useState(inicioMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.listarAuditoria(user.id, desde, hasta).then((res) => {
      if (res.ok) {
        setRegistros(res.data)
        setError('')
      } else setError(res.error)
    })
  }, [desde, hasta, user.id])

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
              <div className="stat-label">Eventos</div>
              <div className="stat-value">{registros.length}</div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Bitácora de actividad</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td>{fechaHora(r.at)}</td>
                  <td>{r.usuarioNombre}</td>
                  <td>{r.accion}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.detalle || '—'}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    No hay actividad registrada en este período.
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

interface ResumenPeriodo {
  turnos: number
  total: number
  sinCuadrar: number
  neto: number
  cobrado: number
  salidas: number
}

function resumirPeriodo(turnos: Turno[]): ResumenPeriodo {
  let total = 0
  let sinCuadrar = 0
  let neto = 0
  for (const t of turnos) {
    const r = resumen(t)
    total += r.total
    if (t.estado === 'cerrado') {
      if (!r.cuadra) sinCuadrar++
      neto += r.dif
    }
  }
  const mov = sumarMovimientos(turnos)
  const cobrado = mov.efectivo + mov.tarjetas + mov.mercadoPago + mov.transferencias + mov.pedidosYa
  const salidas = mov.proveedores + mov.otrosGastos
  return { turnos: turnos.length, total, sinCuadrar, neto, cobrado, salidas }
}

function CompDelta({ a, b }: { a: number; b: number }): JSX.Element {
  const diff = a - b
  if (diff === 0) return <span className="delta flat">— igual</span>
  const up = diff > 0
  return (
    <span className={`delta ${up ? 'good' : 'bad'}`}>
      {up ? '▲' : '▼'} {formatMoney(Math.abs(diff))}
    </span>
  )
}

function Comparar({ user }: { user: Usuario }): JSX.Element {
  const now = new Date()
  const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0)
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [aDesde, setADesde] = useState(inicioMesISO())
  const [aHasta, setAHasta] = useState(hoyISO())
  const [bDesde, setBDesde] = useState(inicioMesAnterior.toLocaleDateString('en-CA'))
  const [bHasta, setBHasta] = useState(finMesAnterior.toLocaleDateString('en-CA'))
  const [turnosA, setTurnosA] = useState<Turno[]>([])
  const [turnosB, setTurnosB] = useState<Turno[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.listarTurnos(user.id, aDesde, aHasta).then((res) => {
      if (res.ok) setTurnosA(res.data)
      else setError(res.error)
    })
  }, [aDesde, aHasta, user.id])

  useEffect(() => {
    window.api.listarTurnos(user.id, bDesde, bHasta).then((res) => {
      if (res.ok) setTurnosB(res.data)
      else setError(res.error)
    })
  }, [bDesde, bHasta, user.id])

  const a = resumirPeriodo(turnosA)
  const b = resumirPeriodo(turnosB)

  const filas: { label: string; va: number; vb: number; goodWhenUp?: boolean; signo?: boolean }[] = [
    { label: 'Turnos cargados', va: a.turnos, vb: b.turnos },
    { label: 'Total de caja', va: a.total, vb: b.total },
    { label: 'Total cobrado', va: a.cobrado, vb: b.cobrado },
    { label: 'Salidas (gastos)', va: a.salidas, vb: b.salidas },
    { label: 'Turnos sin cuadrar', va: a.sinCuadrar, vb: b.sinCuadrar }
  ]

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body">
          <div className="compare-ranges">
            <div className="compare-range a">
              <div className="compare-range-title">Período A</div>
              <div className="filters">
                <label className="filter">
                  <span>Desde</span>
                  <input className="text-input" style={{ width: 'auto' }} type="date" value={aDesde} onChange={(e) => setADesde(e.target.value)} />
                </label>
                <label className="filter">
                  <span>Hasta</span>
                  <input className="text-input" style={{ width: 'auto' }} type="date" value={aHasta} onChange={(e) => setAHasta(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="compare-range b">
              <div className="compare-range-title">Período B</div>
              <div className="filters">
                <label className="filter">
                  <span>Desde</span>
                  <input className="text-input" style={{ width: 'auto' }} type="date" value={bDesde} onChange={(e) => setBDesde(e.target.value)} />
                </label>
                <label className="filter">
                  <span>Hasta</span>
                  <input className="text-input" style={{ width: 'auto' }} type="date" value={bHasta} onChange={(e) => setBHasta(e.target.value)} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Comparación de períodos</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th></th>
                <th className="num">Período A</th>
                <th className="num">Período B</th>
                <th className="num">Diferencia (A − B)</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td className="num">
                    {f.label === 'Turnos cargados' || f.label === 'Turnos sin cuadrar'
                      ? f.va
                      : formatMoney(f.va)}
                  </td>
                  <td className="num">
                    {f.label === 'Turnos cargados' || f.label === 'Turnos sin cuadrar'
                      ? f.vb
                      : formatMoney(f.vb)}
                  </td>
                  <td className="num">
                    {f.label === 'Turnos cargados' || f.label === 'Turnos sin cuadrar'
                      ? f.va - f.vb
                      : <CompDelta a={f.va} b={f.vb} />}
                  </td>
                </tr>
              ))}
              <tr>
                <td>Diferencia de caja</td>
                <td className="num" style={{ color: a.neto > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                  {a.neto === 0 ? '✓ 0' : (a.neto > 0 ? 'Falta ' : 'Sobra ') + formatMoney(Math.abs(a.neto))}
                </td>
                <td className="num" style={{ color: b.neto > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                  {b.neto === 0 ? '✓ 0' : (b.neto > 0 ? 'Falta ' : 'Sobra ') + formatMoney(Math.abs(b.neto))}
                </td>
                <td className="num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
    { label: 'Efectivo', value: sel.mov.efectivo },
    { label: 'Transferencias', value: sel.mov.transferencias }
  ]
  const salidasItems = [
    { label: 'Proveedores', value: sel.mov.proveedores },
    { label: 'Otros gastos', value: sel.mov.otrosGastos }
  ]

  // Ranking de días de la semana por facturación, dentro del mes seleccionado.
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const porDia = DIAS.map((nombre) => ({ nombre, total: 0, turnos: 0 }))
  for (const t of turnos) {
    if (t.fecha.slice(0, 7) !== sel.key) continue
    const [yy, mm, dd] = t.fecha.split('-').map(Number)
    const wd = new Date(yy, mm - 1, dd).getDay()
    porDia[wd].total += resumen(t).total
    porDia[wd].turnos++
  }
  const ranking = porDia.filter((d) => d.turnos > 0).sort((a, b) => b.total - a.total)
  const maxDia = Math.max(1, ...ranking.map((d) => d.total))

  // Desglose por rubro (de dónde viene la plata) del mes seleccionado.
  const rubrosMes = sumarRubros(turnos.filter((t) => t.fecha.slice(0, 7) === sel.key))
  const totalRubros =
    rubrosMes.restaurante +
    rubrosMes.bowling +
    rubrosMes.cumples +
    rubrosMes.eventos +
    rubrosMes.pedidoYa +
    rubrosMes.pool
  // Cantidad de cumples/eventos (para mostrar junto al monto en el desglose).
  const agas = sumarAgasajos(turnos.filter((t) => t.fecha.slice(0, 7) === sel.key))
  const cuentaEv = (n: number): string => `${n} ${n === 1 ? 'evento' : 'eventos'}`
  const cuentaPart = (n: number): string => `${n} ${n === 1 ? 'partido' : 'partidos'}`
  const rubItems = [
    { label: 'Restaurante', value: rubrosMes.restaurante, color: 'var(--primary)', extra: '' },
    { label: 'Pedidos Ya', value: rubrosMes.pedidoYa, color: '#ef4444', extra: '' },
    { label: 'Bowling', value: rubrosMes.bowling, color: '#f59e0b', extra: '' },
    {
      label: 'Pool',
      value: rubrosMes.pool,
      color: '#8b5cf6',
      extra: rubrosMes.poolUnidades ? cuentaPart(rubrosMes.poolUnidades) : ''
    },
    {
      label: 'Cumples + Señas',
      value: rubrosMes.cumples,
      color: '#ec4899',
      extra: agas.cumplesCant ? cuentaEv(agas.cumplesCant) : ''
    },
    {
      label: 'Eventos + Señas',
      value: rubrosMes.eventos,
      color: '#14b8a6',
      extra: agas.eventosCant ? cuentaEv(agas.eventosCant) : ''
    }
  ]
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)

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

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          De dónde viene la plata · {MESES_LARGO[sel.m]} {sel.y}
        </h2>
        <div className="card-body">
          {totalRubros === 0 ? (
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No hay facturación de turnos noche en {MESES_LARGO[sel.m]} para desglosar.
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                Ingresos del mes (turnos noche): <b>{formatMoney(totalRubros)}</b>. <b>No incluye la
                caja base</b> (fondo inicial, no es un ingreso). Cumples y Eventos muestran su ingreso
                completo, incluidos los facturados como mesa.
              </p>
              {rubItems.map((x) => {
                const pct = Math.round((x.value / totalRubros) * 100)
                return (
                  <div className="medio-fila" key={x.label}>
                    <div className="medio-cabecera">
                      <span>
                        {x.label}{' '}
                        <span style={{ color: 'var(--muted)' }}>
                          · {pct}%{x.extra ? ` · ${x.extra}` : ''}
                        </span>
                      </span>
                      <span style={{ fontWeight: 700 }}>{formatMoney(x.value)}</span>
                    </div>
                    <div className="medio-barra">
                      <div
                        className="medio-relleno"
                        style={{ width: `${pct}%`, background: x.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Días que más facturan · {MESES_LARGO[sel.m]} {sel.y}
        </h2>
        <div className="card-body">
          {ranking.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No hay turnos cargados en {MESES_LARGO[sel.m]} para armar el ranking.
            </p>
          ) : (
            ranking.map((d, i) => (
              <div className="medio-fila" key={d.nombre}>
                <div className="medio-cabecera">
                  <span>
                    {i === 0 ? '🏆 ' : ''}
                    {d.nombre} <span style={{ color: 'var(--muted)' }}>· {d.turnos} turno{d.turnos === 1 ? '' : 's'}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(d.total)}</span>
                </div>
                <div className="medio-barra">
                  <div className="medio-relleno in" style={{ width: `${(d.total / maxDia) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Bowling({ user }: { user: Usuario }): JSX.Element {
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

  const noches = turnos.filter((t) => t.tipo === 'noche')
  const conBowling = noches.map((t) => ({ t, monto: bowlingDeTurno(t) })).filter((x) => x.monto > 0)
  const totalBowling = conBowling.reduce((a, x) => a + x.monto, 0)
  const promedio = conBowling.length ? Math.round(totalBowling / conBowling.length) : 0
  const totalNoche = noches.reduce((a, t) => a + cuadreDeTurno(t).total, 0)
  const pct = totalNoche > 0 ? Math.round((totalBowling / totalNoche) * 100) : 0

  // Tendencia por mes (dentro del rango).
  const porMesMap = new Map<string, number>()
  for (const x of conBowling) {
    const k = x.t.fecha.slice(0, 7)
    porMesMap.set(k, (porMesMap.get(k) ?? 0) + x.monto)
  }
  const meses = [...porMesMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, total]) => {
      const [y, m] = k.split('-').map(Number)
      return { key: k, label: `${MESES[m - 1]} ${String(y).slice(2)}`, total }
    })
  const maxMes = Math.max(1, ...meses.map((m) => m.total))

  // Ranking por día de la semana.
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const porDia = DIAS.map((nombre) => ({ nombre, total: 0, noches: 0 }))
  for (const x of conBowling) {
    const [yy, mm, dd] = x.t.fecha.split('-').map(Number)
    const wd = new Date(yy, mm - 1, dd).getDay()
    porDia[wd].total += x.monto
    porDia[wd].noches++
  }
  const ranking = porDia.filter((d) => d.noches > 0).sort((a, b) => b.total - a.total)
  const maxDia = Math.max(1, ...ranking.map((d) => d.total))

  const detalle = [...conBowling].sort((a, b) => (a.t.fecha < b.t.fecha ? 1 : -1))

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
              <div className="stat-label">Noches con bowling</div>
              <div className="stat-value">{conBowling.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total Bowling</div>
              <div className="stat-value">{formatMoney(totalBowling)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Promedio por noche</div>
              <div className="stat-value">{formatMoney(promedio)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">% del total de la noche</div>
              <div className="stat-value">{pct}%</div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {conBowling.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No hay facturación de bowling cargada en este período.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <h2>Facturación de bowling por mes</h2>
            <div className="card-body">
              {meses.map((m) => (
                <div className="medio-fila" key={m.key}>
                  <div className="medio-cabecera">
                    <span>{m.label}</span>
                    <span style={{ fontWeight: 700 }}>{formatMoney(m.total)}</span>
                  </div>
                  <div className="medio-barra">
                    <div className="medio-relleno in" style={{ width: `${(m.total / maxMes) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <h2>Días que más facturan en bowling</h2>
            <div className="card-body">
              {ranking.map((d, i) => (
                <div className="medio-fila" key={d.nombre}>
                  <div className="medio-cabecera">
                    <span>
                      {i === 0 ? '🏆 ' : ''}
                      {d.nombre}{' '}
                      <span style={{ color: 'var(--muted)' }}>
                        · {d.noches} noche{d.noches === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700 }}>{formatMoney(d.total)}</span>
                  </div>
                  <div className="medio-barra">
                    <div className="medio-relleno in" style={{ width: `${(d.total / maxDia) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Detalle por noche</h2>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cajero</th>
                    <th>Estado</th>
                    <th className="num">Bowling</th>
                    <th className="num">% de la noche</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map((x) => {
                    const tot = cuadreDeTurno(x.t).total
                    const p = tot > 0 ? Math.round((x.monto / tot) * 100) : 0
                    return (
                      <tr key={x.t.id}>
                        <td>{fechaLinda(x.t.fecha)}</td>
                        <td>{x.t.usuarioNombre}</td>
                        <td>
                          <span className={`pill ${x.t.estado}`}>{x.t.estado}</span>
                        </td>
                        <td className="num">{formatMoney(x.monto)}</td>
                        <td className="num">{p}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Mapa de número de mesa → mozo (fichada y sin facturar apuntan al mismo mozo).
const MESA_MOZO: Record<string, string> = {
  '10': 'Mostrador',
  '49': 'Mostrador',
  '1': 'Carina',
  '105': 'Carina',
  '4': 'Micaela',
  '67': 'Micaela',
  '3': 'Walter',
  '69': 'Walter',
  '8': 'Walter Hugo',
  '70': 'Walter Hugo',
  '5': 'Adrián',
  '68': 'Adrián',
  '7': 'Adriana',
  '106': 'Adriana',
  '6': 'Yamile',
  '80': 'Yamile',
  '13': 'Telefonista'
}

function Mozos({ user }: { user: Usuario }): JSX.Element {
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

  const noches = turnos.filter((t) => t.tipo === 'noche')
  const acc = new Map<string, { total: number; noches: number; mesas: number }>()
  for (const t of noches) {
    const d = t.data as {
      mesasFacturadas?: { detalle: string; monto: number }[]
      mesasSinFacturar?: { detalle: string; monto: number }[]
    }
    const mesas = [...(d.mesasFacturadas ?? []), ...(d.mesasSinFacturar ?? [])]
    const porMozo = new Map<string, { monto: number; cant: number }>()
    for (const m of mesas) {
      const mozo = MESA_MOZO[String(m.detalle ?? '').trim()] ?? 'Sin asignar'
      const e = porMozo.get(mozo) ?? { monto: 0, cant: 0 }
      e.monto += m.monto || 0
      if ((m.monto || 0) > 0) e.cant += 1
      porMozo.set(mozo, e)
    }
    for (const [mozo, e] of porMozo) {
      const g = acc.get(mozo) ?? { total: 0, noches: 0, mesas: 0 }
      g.total += e.monto
      if (e.monto > 0) g.noches += 1
      g.mesas += e.cant
      acc.set(mozo, g)
    }
  }
  const filas = [...acc.entries()]
    .map(([mozo, e]) => ({
      mozo,
      total: e.total,
      noches: e.noches,
      promedio: e.noches ? e.total / e.noches : 0
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
  const totalGeneral = filas.reduce((a, x) => a + x.total, 0)
  const maxProm = Math.max(1, ...filas.map((x) => x.promedio))

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
              <div className="stat-label">Noches</div>
              <div className="stat-value">{noches.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total vendido (mesas)</div>
              <div className="stat-value">{formatMoney(totalGeneral)}</div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Promedio vendido por noche · por mozo</h2>
        <div className="card-body">
          {filas.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No hay ventas de mesas cargadas en este período.
            </p>
          ) : (
            filas.map((x, i) => (
              <div className="medio-fila" key={x.mozo}>
                <div className="medio-cabecera">
                  <span>
                    {i === 0 ? '🏆 ' : ''}
                    {x.mozo}{' '}
                    <span style={{ color: 'var(--muted)' }}>
                      · {x.noches} noche{x.noches === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(x.promedio)} / noche</span>
                </div>
                <div className="medio-barra">
                  <div className="medio-relleno in" style={{ width: `${(x.promedio / maxProm) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2>Detalle por mozo</h2>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="report" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Mozo</th>
                <th className="num">Total vendido</th>
                <th className="num">Noches</th>
                <th className="num">Promedio por noche</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((x) => (
                <tr key={x.mozo}>
                  <td>{x.mozo}</td>
                  <td className="num">{formatMoney(x.total)}</td>
                  <td className="num">{x.noches}</td>
                  <td className="num">{formatMoney(x.promedio)}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    Sin datos en este período.
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

  // Cajeros con faltantes en turnos consecutivos (posible patrón a revisar).
  const RACHA_MIN = 3
  const porCajeroTurnos = new Map<string, Turno[]>()
  for (const t of cerrados) {
    const k = t.usuarioNombre || '—'
    const arr = porCajeroTurnos.get(k) ?? []
    arr.push(t)
    porCajeroTurnos.set(k, arr)
  }
  const rachas: { nombre: string; cantidad: number; monto: number; desde: string; hasta: string }[] = []
  for (const [nombre, lista] of porCajeroTurnos) {
    const ord = [...lista].sort((a, b) =>
      a.fecha === b.fecha ? a.tipo.localeCompare(b.tipo) : a.fecha < b.fecha ? -1 : 1
    )
    let mejor = { len: 0, monto: 0, desde: '', hasta: '' }
    let curLen = 0
    let curMonto = 0
    let curDesde = ''
    for (const t of ord) {
      const dif = cuadreDeTurno(t).diferencia // >0 = faltante
      if (dif > 0) {
        if (curLen === 0) curDesde = t.fecha
        curLen++
        curMonto += dif
        if (curLen > mejor.len) mejor = { len: curLen, monto: curMonto, desde: curDesde, hasta: t.fecha }
      } else {
        curLen = 0
        curMonto = 0
      }
    }
    if (mejor.len >= RACHA_MIN) {
      rachas.push({ nombre, cantidad: mejor.len, monto: mejor.monto, desde: mejor.desde, hasta: mejor.hasta })
    }
  }
  rachas.sort((a, b) => b.cantidad - a.cantidad)

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
            firmasModificadas.length === 0 &&
            rachas.length === 0 && (
              <div className="banner info" style={{ margin: 0 }}>
                ✓ Sin pendientes en este período: no hay turnos sin cerrar, ni días sin cargar, ni
                diferencias por encima de {formatMoney(umbral)}, ni firmas modificadas, ni cajeros con
                faltantes repetidos.
              </div>
            )}

          {rachas.length > 0 && (
            <div
              style={{
                marginBottom:
                  firmasModificadas.length || abiertos.length || huecos.length || sobreUmbral.length ? 18 : 0
              }}
            >
              <div className="desglose-title" style={{ color: 'var(--bad)' }}>
                Cajeros con faltantes repetidos ({rachas.length})
              </div>
              <table className="report" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Cajero</th>
                    <th className="num">Turnos seguidos con faltante</th>
                    <th className="num">Faltante acumulado</th>
                    <th>Período de la racha</th>
                  </tr>
                </thead>
                <tbody>
                  {rachas.map((r) => (
                    <tr key={r.nombre}>
                      <td>{r.nombre}</td>
                      <td className="num" style={{ color: 'var(--bad)' }}>
                        {r.cantidad}
                      </td>
                      <td className="num">{formatMoney(r.monto)}</td>
                      <td>
                        {r.desde === r.hasta
                          ? fechaLinda(r.desde)
                          : `${fechaLinda(r.desde)} → ${fechaLinda(r.hasta)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

  async function yaTengoCopia(): Promise<void> {
    setError('')
    setOcupado(true)
    const res = await window.api.marcarCopiaHecha(user.id)
    setOcupado(false)
    if (!res.ok) return setError(res.error)
    onCerrar()
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
              <button className="btn" onClick={yaTengoCopia} disabled={ocupado}>
                Ya tengo una copia
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

function Seguridad({ user }: { user: Usuario }): JSX.Element {
  const confirm = useConfirm()
  const [est, setEst] = useState<EstadoSeguridad | null>(null)
  const [nube, setNube] = useState<EstadoNube | null>(null)
  const [mail, setMail] = useState<EstadoMail | null>(null)
  const [modalMail, setModalMail] = useState(false)
  const [sug, setSug] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [modalRec, setModalRec] = useState(false)
  const [modalRestaurar, setModalRestaurar] = useState(false)
  const [modalNube, setModalNube] = useState(false)
  const [modalNubeRestore, setModalNubeRestore] = useState(false)

  function cargar(): void {
    window.api.estadoSeguridad(user.id).then((r) => {
      if (r.ok) setEst(r.data)
      else setError(r.error)
    })
    window.api.estadoNube(user.id).then((r) => {
      if (r.ok) setNube(r.data)
    })
    window.api.estadoMail(user.id).then((r) => {
      if (r.ok) setMail(r.data)
    })
    window.api.sugerenciasRespaldo(user.id).then((r) => {
      if (r.ok) setSug(r.data)
    })
  }
  useEffect(cargar, [user.id])

  function aviso(t: string): void {
    setMsg(t)
    setError('')
    setTimeout(() => setMsg(''), 5000)
  }

  async function elegir(): Promise<void> {
    setOcupado(true)
    const r = await window.api.elegirRespaldo(user.id)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    if (r.data) {
      setEst(r.data)
      aviso('Carpeta de respaldo configurada. Se copió una copia inicial.')
    }
  }
  async function usar(dir: string): Promise<void> {
    setOcupado(true)
    const r = await window.api.usarRespaldo(user.id, dir)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    setEst(r.data)
    aviso('Carpeta de respaldo configurada.')
  }
  async function quitar(): Promise<void> {
    const ok = await confirm({
      mensaje: '¿Dejar de copiar a la carpeta de respaldo externo? (No borra lo ya copiado.)',
      confirmar: 'Quitar',
      peligro: true
    })
    if (!ok) return
    const r = await window.api.quitarRespaldo(user.id)
    if (r.ok) {
      setEst(r.data)
      aviso('Respaldo externo desactivado.')
    } else setError(r.error)
  }
  async function respaldar(): Promise<void> {
    setOcupado(true)
    const r = await window.api.respaldarAhora(user.id)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    setEst(r.data)
    aviso(
      r.data.respaldoPendiente > 0
        ? 'Quedaron copias pendientes (destino no disponible); se reintentan solas.'
        : 'Respaldo realizado correctamente.'
    )
  }

  async function sincronizarNube(): Promise<void> {
    setOcupado(true)
    const r = await window.api.sincronizarNube(user.id)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    setNube(r.data)
    aviso(
      r.data.pendientes > 0
        ? 'Quedaron copias pendientes de subir; se reintentan solas.'
        : 'Sincronizado con la nube.'
    )
  }
  async function quitarNube(): Promise<void> {
    const ok = await confirm({
      mensaje: '¿Dejar de copiar a la nube? (No borra lo ya subido.)',
      confirmar: 'Quitar',
      peligro: true
    })
    if (!ok) return
    const r = await window.api.quitarNube(user.id)
    if (r.ok) {
      setNube(r.data)
      aviso('Copia en la nube desactivada.')
    } else setError(r.error)
  }

  async function quitarMail(): Promise<void> {
    const ok = await confirm({
      mensaje: '¿Dejar de enviar el cierre por email?',
      confirmar: 'Quitar',
      peligro: true
    })
    if (!ok) return
    const r = await window.api.quitarMail(user.id)
    if (r.ok) {
      setMail(r.data)
      aviso('Envío del cierre por email desactivado.')
    } else setError(r.error)
  }

  const recOK = est?.recuperacionConfigurada
  const dir = est?.respaldoDir
  const tituloStyle = { fontWeight: 600, marginBottom: 4 } as const
  const descStyle = { margin: '0 0 4px', color: 'var(--muted)', fontSize: 13, maxWidth: 620 } as const
  const filaStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap' as const
  }

  return (
    <>
      {msg && <div className="banner info">{msg}</div>}
      {error && <div className="error">{error}</div>}
      {est && !recOK && (
        <div className="banner warn">
          <b>Importante:</b> configurá una <b>contraseña de recuperación</b> para poder abrir tus
          copias en otra PC si esta se rompe o se cambia. Sin ella, una copia cifrada solo se abre en
          esta misma máquina.
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Seguridad y respaldo</h2>
        <div className="card-body">
          <div style={filaStyle}>
            <div>
              <div style={tituloStyle}>
                Contraseña de recuperación{' '}
                {recOK ? (
                  <span style={{ color: 'var(--ok)', fontWeight: 700 }}>· Configurada ✓</span>
                ) : (
                  <span style={{ color: 'var(--warn)', fontWeight: 700 }}>· Sin configurar</span>
                )}
              </div>
              <p style={descStyle}>
                Abre las copias cifradas en cualquier PC, aunque se pierda el candado de esta máquina.
                Anotala y guardala en un lugar seguro: sin ella no se pueden recuperar las copias afuera.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setModalRec(true)} disabled={ocupado}>
              {recOK ? 'Cambiar' : 'Configurar'}
            </button>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={filaStyle}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={tituloStyle}>Respaldo externo (Plan B)</div>
              <p style={descStyle}>
                Segunda copia automática y cifrada en un pendrive o en una carpeta de Google
                Drive/OneDrive. Si apuntás a una carpeta de la nube, sube solo y reintenta cuando vuelve
                internet. Si el destino no está disponible, queda pendiente y se reintenta.
              </p>
              {dir ? (
                <div style={{ marginTop: 6 }}>
                  <div>
                    📁 <b style={{ wordBreak: 'break-all' }}>{dir}</b>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {est?.respaldoUltimo
                      ? `Último respaldo: ${fechaHoraLinda(est.respaldoUltimo)}`
                      : 'Sin respaldos todavía'}
                    {est && est.respaldoPendiente > 0 && (
                      <span style={{ color: 'var(--warn)' }}>
                        {' '}
                        · {est.respaldoPendiente} pendiente(s), se reintentan solas
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', marginTop: 6 }}>No configurado.</div>
              )}
            </div>
          </div>

          {!dir && sug.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Detectadas:</span>
              {sug.map((s) => (
                <button key={s} className="btn btn-ghost" onClick={() => usar(s)} disabled={ocupado} title={s}>
                  {s.length > 40 ? '…' + s.slice(-38) : s}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <button className="btn" onClick={elegir} disabled={ocupado}>
              {dir ? 'Cambiar carpeta…' : 'Elegir carpeta…'}
            </button>
            {dir && (
              <button className="btn" onClick={respaldar} disabled={ocupado}>
                Respaldar ahora
              </button>
            )}
            {dir && (
              <button className="btn btn-danger" onClick={quitar} disabled={ocupado}>
                Quitar
              </button>
            )}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={filaStyle}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={tituloStyle}>
                Copia en la nube (Supabase){' '}
                {nube?.configurada ? (
                  <span style={{ color: 'var(--ok)', fontWeight: 700 }}>· Activa ✓</span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontWeight: 700 }}>· No configurada</span>
                )}
              </div>
              <p style={descStyle}>
                La app funciona <b>100% offline</b>. Solo al <b>cerrar un turno</b> sube una copia
                <b> cifrada</b> a la nube (en segundo plano, por las dudas; Supabase nunca ve los datos
                en claro). Si no hay internet, queda pendiente y se reintenta en el próximo cierre.
                Restaurar desde la nube es manual. Necesita un proyecto de Supabase.
              </p>
              {nube?.configurada && (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Usuario: <b>{nube.email}</b> ·{' '}
                  {nube.ultimo ? `Última subida: ${fechaHoraLinda(nube.ultimo)}` : 'Sin subidas aún'}
                  {nube.pendientes > 0 && (
                    <span style={{ color: 'var(--warn)' }}> · {nube.pendientes} pendiente(s)</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <button className="btn" onClick={() => setModalNube(true)} disabled={ocupado}>
              {nube?.configurada ? 'Cambiar conexión…' : 'Conectar Supabase…'}
            </button>
            {nube?.configurada && (
              <button className="btn" onClick={sincronizarNube} disabled={ocupado}>
                Subir copia ahora
              </button>
            )}
            {nube?.configurada && (
              <button className="btn" onClick={() => setModalNubeRestore(true)} disabled={ocupado}>
                Restaurar desde la nube…
              </button>
            )}
            {nube?.configurada && (
              <button className="btn btn-danger" onClick={quitarNube} disabled={ocupado}>
                Quitar
              </button>
            )}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={filaStyle}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={tituloStyle}>
                Enviar cierre por email{' '}
                {mail?.configurado ? (
                  <span style={{ color: 'var(--ok)', fontWeight: 700 }}>· Activo ✓</span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontWeight: 700 }}>· No configurado</span>
                )}
              </div>
              <p style={descStyle}>
                Al cerrar cada turno, manda el reporte (PDF) por mail automáticamente, en segundo plano.
                Si no hay internet, queda pendiente y se reintenta al cerrar el próximo turno. Usa una
                cuenta <b>Gmail con contraseña de aplicación</b>.
              </p>
              {mail?.configurado && (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Envía desde <b>{mail.remitente}</b> → <b>{mail.destino}</b>
                  {mail.pendientes > 0 && (
                    <span style={{ color: 'var(--warn)' }}> · {mail.pendientes} pendiente(s)</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <button className="btn" onClick={() => setModalMail(true)} disabled={ocupado}>
              {mail?.configurado ? 'Cambiar configuración…' : 'Configurar envío por email…'}
            </button>
            {mail?.configurado && (
              <button className="btn btn-danger" onClick={quitarMail} disabled={ocupado}>
                Quitar
              </button>
            )}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={filaStyle}>
            <div>
              <div style={tituloStyle}>Restaurar en otra PC</div>
              <p style={descStyle}>
                Si tenés una copia (.enc) de otra máquina, restaurala con la contraseña de recuperación.
                Tiene que estar junto al archivo <code>caja.recovery.key</code> (la carpeta de respaldo
                lo guarda automáticamente).
              </p>
            </div>
            <button className="btn" onClick={() => setModalRestaurar(true)} disabled={ocupado}>
              Restaurar con contraseña…
            </button>
          </div>
        </div>
      </div>

      {modalRec && (
        <ModalRecovery
          user={user}
          yaConfigurada={!!recOK}
          onClose={() => setModalRec(false)}
          onOk={() => {
            setModalRec(false)
            aviso('Contraseña de recuperación guardada.')
            cargar()
          }}
        />
      )}
      {modalRestaurar && (
        <ModalRestaurarPassword
          user={user}
          onClose={() => setModalRestaurar(false)}
          onOk={() => {
            setModalRestaurar(false)
            setTimeout(() => window.location.reload(), 1500)
          }}
        />
      )}
      {modalNube && (
        <ModalNube
          user={user}
          onClose={() => setModalNube(false)}
          onOk={(e) => {
            setModalNube(false)
            setNube(e)
            aviso('Conectado a la nube. Se subió una copia inicial.')
          }}
        />
      )}
      {modalNubeRestore && (
        <ModalRestaurarNube
          user={user}
          onClose={() => setModalNubeRestore(false)}
          onOk={() => {
            setModalNubeRestore(false)
            setTimeout(() => window.location.reload(), 1500)
          }}
        />
      )}
      {modalMail && (
        <ModalMail
          user={user}
          destinoSugerido={mail?.destino ?? 'info@snackbowling.com.ar'}
          onClose={() => setModalMail(false)}
          onOk={(e) => {
            setModalMail(false)
            setMail(e)
            aviso('Envío del cierre por email activado.')
          }}
        />
      )}
    </>
  )
}

function ModalMail({
  user,
  destinoSugerido,
  onClose,
  onOk
}: {
  user: Usuario
  destinoSugerido: string
  onClose: () => void
  onOk: (e: EstadoMail) => void
}): JSX.Element {
  const [gmail, setGmail] = useState('')
  const [pass, setPass] = useState('')
  const [destino, setDestino] = useState(destinoSugerido)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function guardar(): Promise<void> {
    setError('')
    if (!gmail.trim() || !pass.trim() || !destino.trim()) {
      return setError('Completá el Gmail de envío, la contraseña de aplicación y el destino.')
    }
    setOcupado(true)
    const r = await window.api.configurarMail(user.id, gmail.trim(), pass, destino.trim())
    setOcupado(false)
    if (r.ok) onOk(r.data)
    else setError(r.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Enviar cierre por email (Gmail)</h3>
        <p className="confirm-msg" style={{ marginBottom: 6 }}>
          Al cerrar cada turno se manda el reporte (PDF) a la dirección de destino.
        </p>
        <div
          className="banner info"
          style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}
        >
          <b>Contraseña de aplicación:</b> en la cuenta de Google → Seguridad → activá la{' '}
          <b>verificación en 2 pasos</b> → buscá <b>“Contraseñas de aplicaciones”</b> → creá una y
          pegá acá los 16 caracteres (no es tu contraseña normal de Gmail).
        </div>

        <label className="modal-label">Gmail de envío</label>
        <input
          className="text-input"
          autoFocus
          placeholder="tucuenta@gmail.com"
          value={gmail}
          onChange={(e) => setGmail(e.target.value)}
        />

        <label className="modal-label">Contraseña de aplicación (16 caracteres)</label>
        <input
          className="text-input"
          type="password"
          placeholder="xxxx xxxx xxxx xxxx"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <label className="modal-label">Enviar el cierre a</label>
        <input
          className="text-input"
          placeholder="info@snackbowling.com.ar"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={ocupado}>
            {ocupado ? 'Probando conexión…' : 'Conectar y guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalRestaurarNube({
  user,
  onClose,
  onOk
}: {
  user: Usuario
  onClose: () => void
  onOk: () => void
}): JSX.Element {
  const confirm = useConfirm()
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function restaurar(): Promise<void> {
    setError('')
    if (!pass) return setError('Ingresá la contraseña de recuperación.')
    const ok = await confirm({
      mensaje:
        'Esto baja la última copia de la nube y REEMPLAZA todos los datos actuales de esta PC.\n\n' +
        'Se guarda un resguardo de lo actual por las dudas. La app se va a recargar.\n\n¿Continuar?',
      confirmar: 'Restaurar desde la nube',
      peligro: true
    })
    if (!ok) return
    setOcupado(true)
    const r = await window.api.restaurarNube(user.id, pass)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    onOk()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Restaurar desde la nube</h3>
        <p className="confirm-msg">
          Baja la última copia guardada en Supabase y la restaura en esta PC. Ingresá tu{' '}
          <b>contraseña de recuperación</b> (la copia viaja cifrada y solo se abre con ella).
        </p>
        <label className="modal-label">Contraseña de recuperación</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') restaurar()
          }}
        />
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={restaurar} disabled={ocupado}>
            {ocupado ? 'Restaurando…' : 'Bajar y restaurar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalNube({
  user,
  onClose,
  onOk
}: {
  user: Usuario
  onClose: () => void
  onOk: (estado: EstadoNube) => void
}): JSX.Element {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function conectar(): Promise<void> {
    setError('')
    if (!url.trim() || !anonKey.trim() || !email.trim() || !password) {
      return setError('Completá todos los campos.')
    }
    setOcupado(true)
    const r = await window.api.configurarNube(user.id, url.trim(), anonKey.trim(), email.trim(), password)
    setOcupado(false)
    if (r.ok) onOk(r.data)
    else setError(r.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>Conectar copia en la nube (Supabase)</h3>
        <p className="confirm-msg" style={{ marginBottom: 8 }}>
          La copia sube <b>cifrada</b>: Supabase nunca ve los datos en claro. Datos del proyecto
          (Supabase → Project Settings → API) y del usuario que creaste para la app.
        </p>
        <div className="banner info" style={{ margin: '0 0 12px', fontSize: 13 }}>
          Antes necesitás, en Supabase: 1) un <b>bucket</b> llamado <code>cajasnack</code> (privado),
          2) un <b>usuario</b> (Authentication → Users) con email y contraseña, 3) una política que le
          permita leer/escribir ese bucket. Te paso el SQL exacto si lo necesitás.
        </div>

        <label className="modal-label">URL del proyecto (https://….supabase.co)</label>
        <input
          className="text-input"
          autoFocus
          placeholder="https://xxxx.supabase.co"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <label className="modal-label">Clave pública (anon key)</label>
        <input
          className="text-input"
          placeholder="eyJhbGciOi…"
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
        />

        <label className="modal-label">Email del usuario de la app</label>
        <input
          className="text-input"
          placeholder="caja@minegocio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="modal-label">Contraseña de ese usuario</label>
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') conectar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={conectar} disabled={ocupado}>
            {ocupado ? 'Conectando…' : 'Conectar y probar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalRecovery({
  user,
  yaConfigurada,
  onClose,
  onOk
}: {
  user: Usuario
  yaConfigurada: boolean
  onClose: () => void
  onOk: () => void
}): JSX.Element {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function guardar(): Promise<void> {
    setError('')
    if (p1.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (p1 !== p2) return setError('Las contraseñas no coinciden.')
    setOcupado(true)
    const r = await window.api.configurarRecovery(user.id, p1)
    setOcupado(false)
    if (r.ok) onOk()
    else setError(r.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{yaConfigurada ? 'Cambiar' : 'Configurar'} contraseña de recuperación</h3>
        <p className="confirm-msg">
          Anotala y guardala en un lugar seguro (no en esta misma PC). Es la única forma de abrir las
          copias si esta computadora falla o se cambia.
        </p>
        <label className="modal-label">Contraseña de recuperación</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={p1}
          onChange={(e) => setP1(e.target.value)}
        />
        <label className="modal-label">Repetir contraseña</label>
        <input
          className="text-input"
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar()
          }}
        />
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalRestaurarPassword({
  user,
  onClose,
  onOk
}: {
  user: Usuario
  onClose: () => void
  onOk: (filePath: string) => void
}): JSX.Element {
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function continuar(): Promise<void> {
    setError('')
    if (!pass) return setError('Ingresá la contraseña de recuperación.')
    setOcupado(true)
    const r = await window.api.restaurarConPassword(user.id, pass)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    if (r.data) onOk(r.data)
    else onClose() // se canceló el selector de archivo
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Restaurar con contraseña</h3>
        <p className="confirm-msg">
          Ingresá la contraseña de recuperación y después elegí el archivo de copia (.enc). Reemplaza
          TODOS los datos actuales (se guarda un resguardo antes). La app se va a recargar.
        </p>
        <label className="modal-label">Contraseña de recuperación</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') continuar()
          }}
        />
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={continuar} disabled={ocupado}>
            {ocupado ? 'Restaurando…' : 'Elegir archivo y restaurar'}
          </button>
        </div>
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

      <Seguridad user={user} />

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
