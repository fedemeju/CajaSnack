import { useState } from 'react'
import type { Usuario } from '../../../shared/types'
import { Logo } from '../components/Logo'

export function Login({ onLogin }: { onLogin: (u: Usuario) => void }): JSX.Element {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await window.api.login({ usuario, password })
    setLoading(false)
    if (res.ok) onLogin(res.data)
    else setError(res.error)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Logo className="login-logo" fondoClaro />
        <p>Caja de Snack Bowling</p>

        <label htmlFor="u">Usuario</label>
        <input
          id="u"
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
        />

        <label htmlFor="p">Contraseña</label>
        <input
          id="p"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        {error && <div className="error">{error}</div>}

        <div className="hint">
          Usuarios iniciales: <b>admin</b>, <b>manana</b>, <b>tarde</b>.
          <br />
          Cambiá las contraseñas desde el panel de administración.
        </div>
      </form>
    </div>
  )
}
