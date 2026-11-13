import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmProvider } from './components/Confirm'
import { initTheme } from './lib/theme'
import '@fontsource-variable/inter'
import './styles.css'

initTheme()

// Clickear en cualquier parte de un campo de fecha abre el calendario (no solo el iconito).
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  if (
    t instanceof HTMLInputElement &&
    t.type === 'date' &&
    !t.disabled &&
    typeof (t as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function'
  ) {
    try {
      ;(t as HTMLInputElement & { showPicker: () => void }).showPicker()
    } catch {
      /* ya abierto o no soportado: ignorar */
    }
  }
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>
)
