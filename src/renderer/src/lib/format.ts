const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** Formatea un número como pesos: 12400 -> "$12.400". */
export function formatMoney(n: number): string {
  return '$' + fmt.format(Math.round(n || 0))
}

/** Pesos abreviados para ejes y etiquetas de gráficos: 64137210 -> "$64,1M", 268205 -> "$268k". */
export function formatCompacto(n: number): string {
  const v = Math.abs(n || 0)
  const signo = n < 0 ? '-' : ''
  if (v >= 1e6) {
    const dec = v >= 1e7 ? 0 : 1
    return `${signo}$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: dec })}M`
  }
  if (v >= 1e3) return `${signo}$${Math.round(v / 1e3)}k`
  return `${signo}$${Math.round(v)}`
}

/** Escala "linda" para un eje: tope redondo y paso de 1/2/2,5/5 × 10^n. */
export function escalaEje(max: number, divisiones = 4): { tope: number; paso: number } {
  if (!(max > 0)) return { tope: 1, paso: 1 }
  const bruto = max / divisiones
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot
  return { tope: Math.ceil(max / paso) * paso, paso }
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
