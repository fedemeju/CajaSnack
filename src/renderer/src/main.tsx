import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmProvider } from './components/Confirm'
import { initTheme } from './lib/theme'
import './styles.css'

initTheme()

createRoot(document.getElementById('root') as HTMLElement).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>
)
