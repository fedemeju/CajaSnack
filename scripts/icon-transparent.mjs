import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

// Devuelve transparencia al fondo blanco del icono: hace flood-fill desde los
// bordes convirtiendo el blanco en alfa=0, sin tocar el blanco interior de la
// "C" (queda encerrado por el azul oscuro y el relleno no llega).
const src = process.argv[2]
const dst = process.argv[3] ?? src

const png = PNG.sync.read(readFileSync(src)) // pngjs siempre expone RGBA
const { width: w, height: h, data } = png

const idx = (x, y) => (y * w + x) * 4
const esBlanco = (i) => data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235

const visit = new Uint8Array(w * h)
const stack = []
function push(x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return
  const p = y * w + x
  if (visit[p]) return
  visit[p] = 1
  stack.push(x, y)
}
// Semillas: todo el perímetro.
for (let x = 0; x < w; x++) {
  push(x, 0)
  push(x, h - 1)
}
for (let y = 0; y < h; y++) {
  push(0, y)
  push(w - 1, y)
}

let limpiados = 0
while (stack.length) {
  const y = stack.pop()
  const x = stack.pop()
  const i = idx(x, y)
  if (!esBlanco(i)) continue // frontera: el azul del logo detiene el relleno
  data[i + 3] = 0 // transparente
  limpiados++
  push(x + 1, y)
  push(x - 1, y)
  push(x, y + 1)
  push(x, y - 1)
}

writeFileSync(dst, PNG.sync.write(png))
console.log(`Pixeles vueltos transparentes: ${limpiados} de ${w * h}`)
