// Copia el binario WASM de sql.js a resources/ para que la app lo pueda cargar
// tanto en desarrollo como empaquetada.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
const destDir = join(root, 'resources')
const dest = join(destDir, 'sql-wasm.wasm')

if (!existsSync(src)) {
  console.warn('[copy-wasm] No se encontró sql-wasm.wasm todavía (¿falta npm install?). Se omite.')
  process.exit(0)
}
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log('[copy-wasm] sql-wasm.wasm copiado a resources/')
