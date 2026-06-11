import { useEffect, useState } from 'react'
import { getTheme, type Theme } from '../lib/theme'
import logoClaro from '../assets/logo-horizontal.png'
import logoOscuro from '../assets/logo-horizontal-dark.png'

/** Devuelve el tema actual y se actualiza cuando cambia (modo claro/oscuro). */
function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(getTheme())
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

/**
 * Logo horizontal de la marca. Por defecto elige claro/oscuro según el tema.
 * Si `fondoClaro` es true (ej. una tarjeta siempre blanca como el login), usa
 * siempre la versión de texto oscuro, sin importar el tema.
 */
export function Logo({
  className,
  fondoClaro
}: {
  className?: string
  fondoClaro?: boolean
}): JSX.Element {
  const theme = useTheme()
  const usarOscuro = fondoClaro ? false : theme === 'dark'
  return <img className={className} src={usarOscuro ? logoOscuro : logoClaro} alt="Caja Snack" />
}
