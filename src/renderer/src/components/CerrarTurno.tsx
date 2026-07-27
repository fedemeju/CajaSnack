import { useState } from 'react'
import type { ApiResult, MailEnvioResultado, Turno } from '../../../shared/types'

/**
 * Cuadro para cerrar el turno. Siempre pide el NOMBRE de quién cierra la caja
 * (queda guardado en el turno y en la bitácora). Si la caja no cuadra, lo avisa
 * pero deja cerrar igual. Tras cerrar, envía el reporte por email y muestra la
 * confirmación en el momento (espera el envío antes de dar por terminado).
 */
export function CerrarTurnoModal({
  cuadra,
  avisoDiferencia,
  onConfirm,
  enviarMail,
  onClose
}: {
  cuadra: boolean
  /** Texto del descuadre, ej. "FALTA $1.413.740" (vacío si cuadra). */
  avisoDiferencia: string
  onConfirm: (nombreCajero: string) => Promise<ApiResult<Turno>>
  /** Envía el cierre por email y devuelve el resultado (para confirmar en pantalla). */
  enviarMail?: (turno: Turno, nombreCajero: string) => Promise<MailEnvioResultado>
  onClose: () => void
}): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fase, setFase] = useState<'form' | 'enviando' | 'hecho'>('form')
  const [mailRes, setMailRes] = useState<MailEnvioResultado | null>(null)

  async function confirmar(): Promise<void> {
    setError('')
    if (!nombre.trim()) {
      setError('Ingresá el nombre de quién cierra la caja.')
      return
    }
    setOcupado(true)
    const res = await onConfirm(nombre.trim())
    if (!res.ok) {
      setOcupado(false)
      setError(res.error)
      return
    }
    // Turno cerrado. Si hay envío de email, lo esperamos y mostramos el resultado.
    if (enviarMail) {
      setFase('enviando')
      const m = await enviarMail(res.data, nombre.trim())
      setMailRes(m)
      setFase('hecho')
      setOcupado(false)
    } else {
      setOcupado(false)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={fase === 'enviando' ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cerrar turno</h3>

        {fase === 'form' && (
          <>
            {!cuadra && (
              <div className="banner warn" style={{ marginTop: 0 }}>
                La caja <b>NO cuadra</b> ({avisoDiferencia}). Igual podés cerrar.
              </div>
            )}

            <p className="confirm-msg">
              Ingresá el <b>nombre de la persona que cierra la caja</b>. Queda registrado quién hizo
              el cierre.
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
          </>
        )}

        {fase === 'enviando' && (
          <p className="confirm-msg" style={{ marginBottom: 0 }}>
            ✓ Turno cerrado. <b>Enviando el reporte por email…</b> (puede tardar unos segundos, no
            cierres la ventana).
          </p>
        )}

        {fase === 'hecho' && (
          <>
            {mailRes === 'enviado' && (
              <div className="banner ok" style={{ marginTop: 0 }}>
                ✓ Turno cerrado y <b>reporte enviado por email</b>.
              </div>
            )}
            {mailRes === 'pendiente' && (
              <div className="banner warn" style={{ marginTop: 0 }}>
                ✓ Turno cerrado, pero <b>no se pudo enviar el email ahora</b> (¿sin internet?). Quedó
                pendiente y se reintenta solo al cerrar el próximo turno.
              </div>
            )}
            {mailRes === 'sin-config' && (
              <div className="banner info" style={{ marginTop: 0 }}>
                ✓ Turno cerrado. El envío por email <b>no está configurado</b>.
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose} autoFocus>
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
