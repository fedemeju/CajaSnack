import { app, safeStorage } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import type { EstadoMail } from '../shared/types'

/**
 * Envío del cierre de turno por email (Gmail SMTP con contraseña de aplicación).
 * Best-effort y offline-safe: si no hay internet, el cierre queda pendiente y se
 * reintenta al cerrar el próximo turno. NUNCA bloquea ni rompe el cierre.
 */

export interface CierreMeta {
  fecha: string
  tipo: 'manana' | 'noche'
  tipoLabel: string
  cajero: string
}

interface MailCfg {
  user: string
  passProt: string
  destino: string
}

let cache: MailCfg | null = null
let cacheLeida = false

function cfgPath(): string {
  return join(app.getPath('userData'), 'mail.json')
}
function pendDir(): string {
  const d = join(app.getPath('userData'), 'mail-pendientes')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function protegerPassword(password: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(password).toString('base64')
  }
  return 'plain:' + Buffer.from(password, 'utf8').toString('base64')
}
function revelarPassword(prot: string): string {
  if (prot.startsWith('plain:')) return Buffer.from(prot.slice(6), 'base64').toString('utf8')
  return safeStorage.decryptString(Buffer.from(prot, 'base64'))
}

function leerCfg(): MailCfg | null {
  if (cacheLeida) return cache
  cacheLeida = true
  try {
    const c = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    if (c && typeof c.user === 'string' && c.user) {
      cache = { user: String(c.user), passProt: String(c.passProt), destino: String(c.destino) }
    }
  } catch {
    cache = null
  }
  return cache
}
function guardarCfg(c: MailCfg | null): void {
  cache = c
  cacheLeida = true
  writeFileSync(cfgPath(), JSON.stringify(c ?? {}, null, 2), 'utf8')
}

function transporte(c: MailCfg): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: c.user, pass: revelarPassword(c.passProt) }
  })
}

export function estadoMail(): EstadoMail {
  const c = leerCfg()
  let pendientes = 0
  try {
    pendientes = readdirSync(pendDir()).filter((f) => f.endsWith('.json')).length
  } catch {
    /* sin carpeta aún */
  }
  return {
    configurado: !!c,
    remitente: c?.user ?? null,
    destino: c?.destino ?? null,
    pendientes
  }
}

/** Configura el envío (valida credenciales conectándose a Gmail). */
export async function configurarMail(
  user: string,
  appPassword: string,
  destino: string
): Promise<EstadoMail> {
  const u = user.trim()
  const d = destino.trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u)) throw new Error('El Gmail de envío no es válido.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d)) throw new Error('El email de destino no es válido.')
  if (!appPassword.trim()) throw new Error('Falta la contraseña de aplicación de Gmail.')
  const c: MailCfg = { user: u, passProt: protegerPassword(appPassword.replace(/\s+/g, '')), destino: d }
  await transporte(c).verify() // valida usuario + contraseña de app
  guardarCfg(c)
  return estadoMail()
}

export function quitarMail(): EstadoMail {
  guardarCfg(null)
  return estadoMail()
}

function asunto(meta: CierreMeta): string {
  return `Cierre de caja del día ${meta.fecha} · ${meta.tipoLabel} · cajero ${meta.cajero}`
}

async function enviarUno(c: MailCfg, meta: CierreMeta, pdf: Buffer): Promise<void> {
  await transporte(c).sendMail({
    from: c.user,
    to: c.destino,
    subject: asunto(meta),
    text:
      `Cierre de caja.\n\n` +
      `Fecha: ${meta.fecha}\nTurno: ${meta.tipoLabel}\nCajero: ${meta.cajero}\n\n` +
      `Se adjunta el reporte completo en PDF.`,
    attachments: [{ filename: `caja_${meta.tipo}_${meta.fecha}.pdf`, content: pdf }]
  })
}

/** Reintenta los cierres que quedaron pendientes de enviar. */
export async function flushPendientesMail(): Promise<void> {
  const c = leerCfg()
  if (!c) return
  let archivos: string[]
  try {
    archivos = readdirSync(pendDir()).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }
  for (const f of archivos) {
    const id = f.replace(/\.json$/, '')
    try {
      const meta = JSON.parse(readFileSync(join(pendDir(), f), 'utf8')) as CierreMeta
      const pdf = readFileSync(join(pendDir(), id + '.pdf'))
      await enviarUno(c, meta, pdf)
      unlinkSync(join(pendDir(), f))
      try {
        unlinkSync(join(pendDir(), id + '.pdf'))
      } catch {
        /* ignore */
      }
    } catch {
      /* sigue pendiente; se reintenta la próxima */
    }
  }
}

/**
 * Envía el cierre (PDF) por email. Best-effort: primero reintenta lo pendiente,
 * luego envía el actual; si falla (sin internet), lo deja pendiente. Nunca lanza.
 */
export async function enviarCierre(pdfBytes: Uint8Array, meta: CierreMeta): Promise<void> {
  const c = leerCfg()
  if (!c) return
  const pdf = Buffer.from(pdfBytes)
  await flushPendientesMail().catch(() => {})
  try {
    await enviarUno(c, meta, pdf)
  } catch {
    try {
      const id = `${meta.fecha}_${meta.tipo}`
      writeFileSync(join(pendDir(), id + '.pdf'), pdf)
      writeFileSync(join(pendDir(), id + '.json'), JSON.stringify(meta))
    } catch {
      /* si no se puede ni encolar, se perdió este envío (la copia local/nube siguen) */
    }
  }
}
