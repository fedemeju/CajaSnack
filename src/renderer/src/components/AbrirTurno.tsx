import type { Turno } from '../../../shared/types'
import { fechaLinda } from '../lib/format'

interface Props {
  titulo: string
  fecha: string
  setFecha: (f: string) => void
  existente: Turno | null | undefined
  pendiente: Turno | null | undefined
  error: string
  onAbrir: () => void
}

export function AbrirTurno({
  titulo,
  fecha,
  setFecha,
  existente,
  pendiente,
  error,
  onAbrir
}: Props): JSX.Element {
  const cargando = existente === undefined || pendiente === undefined
  const cerrado = existente?.estado === 'cerrado'
  const abiertoYa = existente?.estado === 'abierto'
  // Quedó un turno abierto sin cerrar: hay que cerrarlo antes de abrir uno nuevo
  const otroPendiente = !!pendiente

  return (
    <div>
      <div className="page-title">
        <h1>{titulo}</h1>
      </div>

      <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
        <h2>Abrir turno</h2>
        <div className="card-body">
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Elegí la fecha del turno. Mientras esté abierto, todo lo que cargues se{' '}
            <b>guarda automáticamente</b>.
          </p>

          <div className="field">
            <label>Fecha del turno</label>
            <input
              className="text-input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          {cargando && <div className="banner info" style={{ marginTop: 12 }}>Verificando…</div>}

          {!cargando && otroPendiente && (
            <div className="banner warn" style={{ marginTop: 12 }}>
              Quedó el turno del <b>{fechaLinda(pendiente!.fecha)}</b> sin cerrar. Antes de abrir uno
              nuevo tenés que cerrar ese. Al continuar, vas directo a ese turno.
            </div>
          )}

          {!cargando && !otroPendiente && abiertoYa && (
            <div className="banner warn" style={{ marginTop: 12 }}>
              Ya hay un turno <b>abierto</b> para el {fechaLinda(fecha)}. Al continuar, retomás esa
              carga.
            </div>
          )}

          {!cargando && !otroPendiente && cerrado && (
            <div className="banner info" style={{ marginTop: 12 }}>
              El turno del {fechaLinda(fecha)} ya está <b>cerrado</b>. Lo vas a ver en modo solo
              lectura.
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={onAbrir} disabled={cargando}>
              {otroPendiente
                ? 'Ir al turno sin cerrar'
                : cerrado
                  ? 'Ver turno'
                  : abiertoYa
                    ? 'Continuar turno'
                    : 'Abrir turno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Indicador de estado de autoguardado para el encabezado del formulario. */
export function GuardadoBadge({
  guardando,
  guardadoLabel
}: {
  guardando: boolean
  guardadoLabel: string
}): JSX.Element {
  if (!guardando && !guardadoLabel) return <span />
  const estado = guardando ? 'guardando' : guardadoLabel === 'Turno cerrado' ? 'cerrado' : 'ok'
  return (
    <span className={`estado-pill ${estado}`}>
      <span className="estado-dot" aria-hidden />
      {guardando ? 'Guardando…' : guardadoLabel}
    </span>
  )
}

/** "2026-11-09" -> "Lunes 9 de noviembre de 2026". */
function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return fechaLinda(iso)
  const txt = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  return txt.charAt(0).toUpperCase() + txt.slice(1).replace(',', '')
}

/** Encabezado de la pantalla de un turno: ícono, nombre, fecha y estado de guardado. */
export function EncabezadoTurno({
  tipo,
  fecha,
  guardando,
  guardadoLabel
}: {
  tipo: 'manana' | 'noche'
  fecha: string
  guardando: boolean
  guardadoLabel: string
}): JSX.Element {
  return (
    <div className="page-title turno-head">
      <div className="turno-head-main">
        <span className={`turno-head-icon ${tipo}`} aria-hidden>
          {tipo === 'noche' ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </span>
        <div>
          <h1>{tipo === 'noche' ? 'Turno Noche' : 'Turno Mañana'}</h1>
          <div className="turno-head-fecha">{fechaLarga(fecha)}</div>
        </div>
      </div>
      <GuardadoBadge guardando={guardando} guardadoLabel={guardadoLabel} />
    </div>
  )
}
