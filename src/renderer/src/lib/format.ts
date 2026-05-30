const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** Formatea un número como pesos: 12400 -> "$12.400". */
export function formatMoney(n: number): string {
  return '$' + fmt.format(Math.round(n || 0))
}

/** Formatea sin el signo $: 12400 -> "12.400". */
export function formatNumber(n: number): string {
  return fmt.format(Math.round(n || 0))
}

/** Extrae un entero de pesos a partir de lo que escribió el usuario. */
export function parseMoney(str: string): number {
  const neg = /-/.test(str)
  const digits = str.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return neg ? -n : n
}

export function hoyISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** "2026-05-28" -> "28/05/2026" */
export function fechaLinda(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** ISO datetime -> "28/05/2026 21:34" (hora local). */
export function fechaHora(iso: string): string {
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return iso
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()} ${hh}:${mi}`
}
