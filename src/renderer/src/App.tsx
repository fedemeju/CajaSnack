import { useEffect, useState } from 'react'
import type { Usuario } from '../../shared/types'
import { Login } from './pages/Login'
import { TurnoManana } from './pages/TurnoManana'
import { TurnoNoche } from './pages/TurnoNoche'
import { Admin } from './pages/Admin'
import { getTheme, toggleTheme, type Theme } from './lib/theme'
import { Logo } from './components/Logo'

function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(getTheme())
  const oscuro = theme === 'dark'
  return (
    <button
      className="btn btn-ghost"
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={() => setTheme(toggleTheme())}
    >
      {oscuro ? 'Claro' : 'Oscuro'}
    </button>
  )
}

export default function App(): JSX.Element {
  const [user, setUser] = useState<Usuario | null>(null)
  const [bloqueada, setBloqueada] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.estaBloqueada().then((r) => setBloqueada(r.ok ? r.data : false))
  }, [])

  if (bloqueada === null) return <div className="app" />
  if (bloqueada) return <Desbloquear onListo={() => window.location.reload()} />

  if (!user) return <Login onLogin={setUser} />

  // El admin tiene su propio layout de pantalla completa (riel lateral tipo MeLi).
  if (user.rol === 'admin') {
    return <Admin user={user} onLogout={() => setUser(null)} themeToggle={<ThemeToggle />} />
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <Logo className="brand-logo" />
        </div>
        <div className="right">
          <span className="role-tag">{rolLabel(user.rol)}</span>
          <ThemeToggle />
          <button className="btn btn-danger" onClick={() => setUser(null)}>
            Cerrar sesión
          </button>
        </div>
      </div>
      <div className="content">
        {user.rol === 'manana' && <TurnoManana user={user} />}
        {user.rol === 'tarde' && <TurnoNoche user={user} />}
      </div>
    </div>
  )
}

function rolLabel(rol: string): string {
  if (rol === 'manana') return 'Turno Mañana'
  if (rol === 'tarde') return 'Turno Noche'
  return 'Administrador'
}

/**
 * Pantalla de recuperación: aparece cuando la base existe pero no se pudo abrir
 * con la clave de esta PC (cambió el candado del SO o es de otra máquina).
 * Permite recuperar en el lugar con la contraseña de recuperación, o restaurar
 * una copia (.enc) con esa contraseña.
 */
function Desbloquear({ onListo }: { onListo: () => void }): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState('')

  async function desbloquear(): Promise<void> {
    setError('')
    if (!password) return setError('Ingresá la contraseña de recuperación.')
    setOcupado('desbloquear')
    const r = await window.api.desbloquear(password)
    setOcupado('')
    if (r.ok) onListo()
    else setError(r.error)
  }

  async function restaurar(): Promise<void> {
    setError('')
    if (!password) return setError('Ingresá la contraseña de recuperación primero.')
    setOcupado('restaurar')
    const r = await window.api.restaurarInicial(password)
    setOcupado('')
    if (!r.ok) return setError(r.error)
    if (r.data) onListo()
  }

  return (
    <div className="app">
      <div
        style={{
          maxWidth: 520,
          margin: '8vh auto',
          padding: 28,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Logo className="login-logo" />
        <h2 style={{ marginTop: 0 }}>No se pudo abrir la base en esta PC</h2>
        <p style={{ color: 'var(--muted)' }}>
          Tus datos están guardados, pero esta computadora no tiene la clave para abrirlos (puede
          haber cambiado Windows o la PC). Ingresá tu <b>contraseña de recuperación</b> para
          recuperarlos acá mismo.
        </p>

        <label className="modal-label">Contraseña de recuperación</label>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') desbloquear()
          }}
        />

        {error && <div className="error">{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={desbloquear} disabled={!!ocupado}>
            {ocupado === 'desbloquear' ? 'Recuperando…' : 'Recuperar datos'}
          </button>
          <button className="btn" onClick={restaurar} disabled={!!ocupado}>
            {ocupado === 'restaurar' ? 'Restaurando…' : 'Restaurar desde una copia…'}
          </button>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 16, marginBottom: 0 }}>
          Si esta PC no tiene la contraseña guardada, usá <b>“Restaurar desde una copia…”</b> y elegí
          un archivo <code>.enc</code> (del pendrive, Drive o la nube) que tenga al lado su{' '}
          <code>caja.recovery.key</code>.
        </p>
      </div>
    </div>
  )
}
