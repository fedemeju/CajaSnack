import { POOL_PRECIO_DEFECTO } from '../../../shared/types'

/**
 * Precio del Pool "por defecto" guardado en este PC. Se usa al abrir turnos
 * nuevos, así no hay que reescribirlo cada vez. Se actualiza cuando el usuario
 * edita el precio con el lápiz (✎) en el campo Pool.
 */
const KEY = 'cajasnack-pool-precio'

export function getPoolPrecio(): number {
  const v = Number(localStorage.getItem(KEY))
  return Number.isFinite(v) && v > 0 ? Math.round(v) : POOL_PRECIO_DEFECTO
}

export function setPoolPrecio(n: number): void {
  if (Number.isFinite(n) && n > 0) localStorage.setItem(KEY, String(Math.round(n)))
}
