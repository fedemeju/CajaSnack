import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface WindowState {
  bounds?: Rectangle
  maximized?: boolean
}

const DEFAULTS = { width: 1280, height: 860 }

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function leer(): WindowState {
  try {
    if (!existsSync(statePath())) return {}
    return JSON.parse(readFileSync(statePath(), 'utf8')) as WindowState
  } catch {
    return {}
  }
}

/** ¿Los bounds guardados caen dentro de algún monitor conectado? */
function visibleEnAlgunMonitor(b: Rectangle): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y
  })
}

/** Opciones de tamaño/posición para crear la ventana, validadas contra los monitores actuales. */
export function boundsIniciales(): { bounds: Partial<Rectangle>; maximized: boolean } {
  const st = leer()
  if (st.bounds && visibleEnAlgunMonitor(st.bounds)) {
    return { bounds: st.bounds, maximized: !!st.maximized }
  }
  return { bounds: DEFAULTS, maximized: !!st.maximized }
}

/** Guarda el tamaño/posición actual (usa los bounds "normales" aunque esté maximizada). */
export function guardarEstadoVentana(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return
    writeFileSync(
      statePath(),
      JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() })
    )
  } catch {
    /* si no se puede guardar el estado, no es crítico */
  }
}

/** Engancha el guardado del estado a los eventos de la ventana (con debounce). */
export function seguirEstadoVentana(win: BrowserWindow): void {
  let t: ReturnType<typeof setTimeout> | null = null
  const programar = (): void => {
    if (t) clearTimeout(t)
    t = setTimeout(() => guardarEstadoVentana(win), 400)
  }
  win.on('resize', programar)
  win.on('move', programar)
  win.on('close', () => {
    if (t) clearTimeout(t)
    guardarEstadoVentana(win)
  })
}
