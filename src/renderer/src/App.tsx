import { useState } from 'react'
import type { Usuario } from '../../shared/types'
import { Login } from './pages/Login'
import { TurnoManana } from './pages/TurnoManana'
import { TurnoNoche } from './pages/TurnoNoche'
import { Admin } from './pages/Admin'
import { getTheme, toggleTheme, type Theme } from './lib/theme'
import logo from './assets/logo-horizontal.png'

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

  if (!user) return <Login onLogin={setUser} />

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Caja Snack" />
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
        {user.rol === 'admin' && <Admin user={user} />}
      </div>
    </div>
  )
}

function rolLabel(rol: string): string {
  if (rol === 'manana') return 'Turno Mañana'
  if (rol === 'tarde') return 'Turno Noche'
  return 'Administrador'
}
