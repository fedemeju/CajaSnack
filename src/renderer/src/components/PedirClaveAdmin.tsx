import { useState } from 'react'
import type { ApiResult, Turno } from '../../../shared/types'

/**
 * Modal que pide la contraseña de un administrador para autorizar una acción
 * sensible (p. ej. reabrir un turno ya cerrado). Llama a `accion(password)` y
 * cierra si sale bien; muestra el error si la clave es incorrecta.
 */
export function PedirClaveAdmin({
  titulo,
  mensaje,
  confirmar = 'Confirmar',
  accion,
  onListo,
  onClose
}: {
  titulo: string
  mensaje: string
  confirmar?: string
  accion: (password: string) => Promise<ApiResult<Turno>>
  onListo: () => void
  onClose: () => void
}): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function confirmarAccion(): Promise<void> {
    setError('')
    if (!password) {
      setError('Ingresá la contraseña de administrador.')
      return
    }
    setOcupado(true)
    const res = await accion(password)
    setOcupado(false)
    if (res.ok) onListo()
    else setError(res.error)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p className="confirm-msg">{mensaje}</p>

        <label className="modal-label">Contraseña de administrador</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarAccion()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={confirmarAccion} disabled={ocupado}>
            {ocupado ? 'Verificando…' : confirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
