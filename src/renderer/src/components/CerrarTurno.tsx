import { useState } from 'react'
import type { ApiResult, Turno } from '../../../shared/types'

/**
 * Cuadro para cerrar el turno. Siempre pide el NOMBRE de quién cierra la caja
 * (queda guardado en el turno y en la bitácora). Si la caja no cuadra, lo avisa
 * pero deja cerrar igual.
 */
export function CerrarTurnoModal({
  cuadra,
  avisoDiferencia,
  onConfirm,
  onClose
}: {
  cuadra: boolean
  /** Texto del descuadre, ej. "FALTA $1.413.740" (vacío si cuadra). */
  avisoDiferencia: string
  onConfirm: (nombreCajero: string) => Promise<ApiResult<Turno>>
  onClose: () => void
}): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function confirmar(): Promise<void> {
    setError('')
    if (!nombre.trim()) {
      setError('Ingresá el nombre de quién cierra la caja.')
      return
    }
    setOcupado(true)
    const res = await onConfirm(nombre.trim())
    setOcupado(false)
    if (!res.ok) setError(res.error)
    else onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cerrar turno</h3>

        {!cuadra && (
          <div className="banner warn" style={{ marginTop: 0 }}>
            La caja <b>NO cuadra</b> ({avisoDiferencia}). Igual podés cerrar.
          </div>
        )}

        <p className="confirm-msg">
          Ingresá el <b>nombre de la persona que cierra la caja</b>. Queda registrado quién hizo el
          cierre.
        </p>

        <label className="modal-label">¿Quién cierra la caja?</label>
        <input
          className="text-input"
          autoFocus
          placeholder="Nombre del cajero"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button
            className={`btn ${cuadra ? 'btn-primary' : 'btn-danger'}`}
            onClick={confirmar}
            disabled={ocupado}
          >
            {ocupado ? 'Cerrando…' : cuadra ? 'Cerrar turno' : 'Cerrar igual'}
          </button>
        </div>
      </div>
    </div>
  )
}
