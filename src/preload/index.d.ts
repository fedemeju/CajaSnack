import type { CajaApi } from './index'

declare global {
  interface Window {
    api: CajaApi
  }
}

export {}
