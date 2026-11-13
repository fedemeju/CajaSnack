import { useState } from 'react'
import type { Usuario } from '../../../shared/types'
import { getTheme, toggleTheme, type Theme } from '../lib/theme'

function rolLabel(rol: string): string {
  if (rol === 'manana') return 'Turno Mañana'
  if (rol === 'tarde') return 'Turno Noche'
  return 'Administrador'
}

/** "Juan Pérez" -> "JP", "Turno Noche" -> "TN", "admin" -> "A". */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

/** Botón de tema: ícono de sol (para pasar a claro) o luna (para pasar a oscuro). */
export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(getTheme())
  const oscuro = theme === 'dark'
  const label = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button className="topbar-icon-btn" title={label} aria-label={label} onClick={() => setTheme(toggleTheme())}>
      {oscuro ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

/** Lado derecho de la barra superior: quién está usando la caja, tema y salir. */
export function TopbarAcciones({
  user,
  onLogout,
  themeToggle
}: {
  user: Usuario
  onLogout: () => void
  themeToggle: JSX.Element
}): JSX.Element {
  const rol = rolLabel(user.rol)
  const nombre = user.nombre?.trim() || user.usuario
  return (
    <div className="topbar-acciones">
      <div className="user-chip" title={`${nombre} · ${rol}`}>
        <span className={`user-avatar rol-${user.rol}`} aria-hidden>
          {iniciales(nombre)}
        </span>
        <span className="user-chip-text">
          <span className="user-chip-nombre">{nombre}</span>
          {nombre !== rol && <span className="user-chip-rol">{rol}</span>}
        </span>
      </div>
      <span className="topbar-sep" aria-hidden />
      {themeToggle}
      <button className="topbar-salir" onClick={onLogout} title="Cerrar sesión">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        Cerrar sesión
      </button>
    </div>
  )
}
