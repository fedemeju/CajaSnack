import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import icon from '../../resources/icon.png?asset'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { seedUsuarios } from './seed'
import { boundsIniciales, seguirEstadoVentana } from './windowState'

let mainWindow: BrowserWindow | null = null
/** El renderer avisa si hay un guardado en vuelo, para advertir antes de cerrar. */
let guardandoEnVuelo = false
/** Una vez confirmado el cierre, no volvemos a preguntar. */
let permitirCierre = false

function createWindow(): void {
  const { bounds, maximized } = boundsIniciales()
  const win = new BrowserWindow({
    width: bounds.width ?? 1280,
    height: bounds.height ?? 860,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'CajaSnack',
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win
  if (maximized) win.maximize()
  seguirEstadoVentana(win)

  win.on('ready-to-show', () => win.show())

  // Si hay cambios guardándose, confirmamos antes de cerrar para no perderlos.
  win.on('close', (e) => {
    if (permitirCierre || !guardandoEnVuelo) return
    e.preventDefault()
    const resp = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Esperar', 'Cerrar igual'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'Guardando cambios',
      message: 'Se están guardando cambios',
      detail:
        'Todavía hay cambios guardándose. Si cerrás ahora podrías perder lo último que cargaste. ' +
        'Esperá un segundo y volvé a cerrar.'
    })
    if (resp === 1) {
      permitirCierre = true
      win.close()
    }
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Candado de instancia única: una sola ventana sobre el mismo archivo cifrado.
const obtuvoLock = app.requestSingleInstanceLock()
if (!obtuvoLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    await initDb()
    seedUsuarios()
    registerIpc()

    // El renderer informa si tiene un guardado pendiente/en curso.
    ipcMain.on('app:guardando', (_e, valor: boolean) => {
      guardandoEnVuelo = !!valor
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
