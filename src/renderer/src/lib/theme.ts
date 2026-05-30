export type Theme = 'light' | 'dark'

const KEY = 'cajasnack-theme'

export function getTheme(): Theme {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

function aplicar(t: Theme): void {
  document.documentElement.dataset.theme = t
}

/** Aplica el tema guardado al arrancar (antes del render para evitar parpadeo). */
export function initTheme(): void {
  aplicar(getTheme())
}

/** Alterna claro/oscuro, lo persiste y devuelve el nuevo valor. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  localStorage.setItem(KEY, next)
  aplicar(next)
  return next
}
