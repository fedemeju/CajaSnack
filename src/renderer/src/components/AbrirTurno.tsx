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
  return (
    <span style={{ color: 'var(--muted)', fontSize: 13 }}>
      {guardando ? '● Guardando…' : guardadoLabel ? '✓ ' + guardadoLabel : ''}
    </span>
  )
}
