import type { LabelHTMLAttributes, ReactNode } from 'react'
import {
  ArrowLeftRight,
  Banknote,
  Bike,
  Cake,
  ConciergeBell,
  CreditCard,
  GraduationCap,
  Handshake,
  Mail,
  PartyPopper,
  Receipt,
  Store,
  Ticket,
  Utensils,
  Wallet,
  type LucideIcon
} from 'lucide-react'

/** Pino de bowling (Lucide no tiene uno). Mismo estilo de trazo que los demás íconos. */
export function PinoBowling({ size = 17 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-1.7 0-2.6 1.4-2.3 3.2.2 1.2.8 2 .8 2.8 0 1-1.9 2.6-2.4 5.4-.6 3.3.5 6.6 1.6 8.6h4.6c1.1-2 2.2-5.3 1.6-8.6-.5-2.8-2.4-4.4-2.4-5.4 0-.8.6-1.6.8-2.8C14.6 3.4 13.7 2 12 2z" />
      <path d="M10.2 8.2h3.6" />
    </svg>
  )
}

/** Caja registradora: visor arriba, teclado y cajón. */
function Registradora({ size = 17 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="2.5" width="8" height="4" rx="1" />
      <path d="M10.5 6.5V9" />
      <path d="M4 15.5 5.4 9h13.2l1.4 6.5" />
      <rect x="2.5" y="15.5" width="19" height="6" rx="1.5" />
      <path d="M10 18.5h4" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  )
}

/** Bola de pool (la 8) en línea, del mismo estilo y color que los demás íconos. */
function BolaPool({ size = 19 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        {/* El "8" (dos aritos apilados) queda calado dentro del círculo relleno. */}
        <mask id="bola8-ocho">
          <rect width="24" height="24" fill="#fff" />
          <circle cx="12" cy="8.9" r="1.55" fill="none" stroke="#000" strokeWidth="1.5" />
          <circle cx="12" cy="12.35" r="1.85" fill="none" stroke="#000" strokeWidth="1.5" />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10.7" r="5.4" fill="currentColor" mask="url(#bola8-ocho)" />
    </svg>
  )
}

type Icono = LucideIcon | 'pino' | 'registradora' | 'pool'

/**
 * Ícono según el texto de la etiqueta (el orden importa: lo más específico primero).
 * Para cambiar o quitar un ícono, se edita sólo esta lista.
 */
const REGLAS: [RegExp, Icono][] = [
  [/mercado pago/i, Handshake],
  [/sobres?/i, Mail],
  [/efectivo|retirad|otros gastos/i, Banknote],
  [/tarjeta/i, CreditCard],
  [/caja base|caja dejada/i, 'registradora'],
  [/pedidos? ya/i, Bike],
  [/mostrador|tel[eé]fono/i, Store],
  [/factura|proveedor|lincoln/i, Receipt],
  [/instructora/i, GraduationCap],
  [/vale/i, Ticket],
  [/transferencia/i, ArrowLeftRight],
  [/cumple/i, Cake],
  [/evento/i, PartyPopper],
  [/bowling/i, 'pino'],
  [/pool/i, 'pool'],
  [/mozo/i, ConciergeBell],
  [/mesa/i, Utensils],
  [/otros/i, Wallet]
]

function iconoPara(texto: string): Icono | null {
  // Los totales calculados no llevan ícono (sí "Total Bowling", que se carga a mano).
  if (/^total\b/i.test(texto) && !/^total bowling/i.test(texto)) return null
  for (const [re, ic] of REGLAS) if (re.test(texto)) return ic
  return null
}

function textoDe(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textoDe).join('')
  return ''
}

/** Etiqueta de un ítem de la caja con su ícono a la izquierda. */
export function Rotulo({ children, className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  const ic = iconoPara(textoDe(children))
  return (
    <label className={`rotulo ${className ?? ''}`} {...rest}>
      <span className={`rotulo-icono ${ic ? '' : 'vacio'}`} aria-hidden>
        {ic === 'pino' ? (
          <PinoBowling />
        ) : ic === 'registradora' ? (
          <Registradora />
        ) : ic === 'pool' ? (
          <BolaPool />
        ) : ic ? (
          (() => {
            const C = ic
            return <C size={17} strokeWidth={2} />
          })()
        ) : null}
      </span>
      <span>{children}</span>
    </label>
  )
}
