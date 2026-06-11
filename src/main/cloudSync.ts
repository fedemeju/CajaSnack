import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EstadoNube } from '../shared/types'

/**
 * Sincronización opcional con Supabase Storage como respaldo en la nube.
 * - Sube SIEMPRE el bloque YA CIFRADO (.enc): Supabase nunca ve datos en claro
 *   (zero-knowledge; sin la contraseña de recuperación la copia es inútil).
 * - Es best-effort: si no hay internet o el destino falla, encola y reintenta.
 *   NUNCA debe romper la operación de la caja.
 * - Usa la API REST (fetch nativo de Node), sin dependencias extra.
 */

const BUCKET = 'cajasnack'

interface CloudCfg {
  url: string
  anonKey: string
  email: string
  /** Contraseña protegida con safeStorage (base64) o con prefijo "plain:" como fallback. */
  passwordProt: string
  ultimo: string | null
  pendientes: string[]
}

let cache: CloudCfg | null = null
let cacheLeida = false
let token: { value: string; exp: number } | null = null

function cfgPath(): string {
  return join(app.getPath('userData'), 'cloud.json')
}
function backupsDir(): string {
  return join(app.getPath('userData'), 'backups')
}
function dbEncPath(): string {
  return join(app.getPath('userData'), 'caja.db.enc')
}
function recoveryPath(): string {
  return join(app.getPath('userData'), 'caja.recovery.key')
}

function protegerPassword(password: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(password).toString('base64')
  }
  return 'plain:' + Buffer.from(password, 'utf8').toString('base64')
}
function revelarPassword(prot: string): string {
  if (prot.startsWith('plain:')) {
    return Buffer.from(prot.slice(6), 'base64').toString('utf8')
  }
  return safeStorage.decryptString(Buffer.from(prot, 'base64'))
}

function leerCfg(): CloudCfg | null {
  if (cacheLeida) return cache
  cacheLeida = true
  try {
    const c = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    if (c && typeof c.url === 'string') {
      cache = {
        url: c.url.replace(/\/+$/, ''),
        anonKey: String(c.anonKey),
        email: String(c.email),
        passwordProt: String(c.passwordProt),
        ultimo: typeof c.ultimo === 'string' ? c.ultimo : null,
        pendientes: Array.isArray(c.pendientes) ? c.pendientes.map(String) : []
      }
    }
  } catch {
    cache = null
  }
  return cache
}
function guardarCfg(c: CloudCfg): void {
  cache = c
  cacheLeida = true
  writeFileSync(cfgPath(), JSON.stringify(c, null, 2), 'utf8')
}

export function estadoNube(): EstadoNube {
  const c = leerCfg()
  if (!c) return { configurada: false, email: null, ultimo: null, pendientes: 0 }
  return { configurada: true, email: c.email, ultimo: c.ultimo, pendientes: c.pendientes.length }
}

/** Inicia sesión contra Supabase Auth y devuelve un access_token. */
async function obtenerToken(c: CloudCfg): Promise<string> {
  if (token && token.exp - 60_000 > Date.now()) return token.value
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const resp = await fetch(`${c.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: c.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: c.email, password: revelarPassword(c.passwordProt) }),
      signal: ctrl.signal
    })
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    if (!resp.ok || !data.access_token) {
      const msg = String(data.error_description || data.msg || data.error || `HTTP ${resp.status}`)
      throw new Error(`No se pudo iniciar sesión en Supabase: ${msg}`)
    }
    const exp = Date.now() + Number(data.expires_in ?? 3600) * 1000
    token = { value: String(data.access_token), exp }
    return token.value
  } finally {
    clearTimeout(t)
  }
}

/** Sube un buffer al bucket en la ruta dada (sobrescribe). */
async function subirObjeto(c: CloudCfg, ruta: string, buf: Buffer): Promise<void> {
  const tok = await obtenerToken(c)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const resp = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: c.anonKey,
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: new Uint8Array(buf),
      signal: ctrl.signal
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`Error al subir (${resp.status}): ${txt.slice(0, 200)}`)
    }
  } finally {
    clearTimeout(t)
  }
}

/** Sube la copia "última" (db + llave de recuperación) si existen. */
async function subirUltima(c: CloudCfg): Promise<void> {
  if (existsSync(dbEncPath())) {
    await subirObjeto(c, 'latest/caja.db.enc', readFileSync(dbEncPath()))
  }
  if (existsSync(recoveryPath())) {
    await subirObjeto(c, 'latest/caja.recovery.key', readFileSync(recoveryPath()))
  }
}

/** Configura/actualiza la nube. Valida iniciando sesión y subiendo la copia actual. */
export async function configurarNube(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<EstadoNube> {
  const limpio = String(url || '').trim().replace(/\/+$/, '')
  if (!/^https:\/\/.+/.test(limpio)) throw new Error('La URL del proyecto debe empezar con https://')
  if (!anonKey.trim()) throw new Error('Falta la clave pública (anon key).')
  if (!email.trim() || !password) throw new Error('Falta el email o la contraseña del usuario de la app.')
  const previa = leerCfg()
  const c: CloudCfg = {
    url: limpio,
    anonKey: anonKey.trim(),
    email: email.trim(),
    passwordProt: protegerPassword(password),
    ultimo: previa?.ultimo ?? null,
    pendientes: previa?.pendientes ?? []
  }
  token = null
  await subirUltima(c) // valida credenciales + permisos + sube ya
  c.ultimo = new Date().toISOString()
  guardarCfg(c)
  return estadoNube()
}

export function quitarNube(): EstadoNube {
  cache = null
  cacheLeida = true
  token = null
  try {
    if (existsSync(cfgPath())) writeFileSync(cfgPath(), JSON.stringify({}, null, 2), 'utf8')
  } catch {
    /* nada */
  }
  return { configurada: false, email: null, ultimo: null, pendientes: 0 }
}

/** Descarga un objeto del bucket. Lanza si falla. */
async function descargarObjeto(c: CloudCfg, ruta: string): Promise<Buffer> {
  const tok = await obtenerToken(c)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const resp = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${ruta}`, {
      headers: { apikey: c.anonKey, Authorization: `Bearer ${tok}` },
      signal: ctrl.signal
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`No se pudo bajar de la nube (${resp.status}): ${txt.slice(0, 160)}`)
    }
    return Buffer.from(await resp.arrayBuffer())
  } finally {
    clearTimeout(t)
  }
}

/**
 * Descarga la copia "última" de la nube (db cifrada + llave de recuperación) a
 * una carpeta destino y devuelve la ruta del .enc. Luego se restaura con la
 * contraseña de recuperación (la llave queda al lado, como pide restaurarConPassword).
 */
export async function descargarUltimaA(destDir: string): Promise<string> {
  const c = leerCfg()
  if (!c) throw new Error('No hay copia en la nube configurada.')
  mkdirSync(destDir, { recursive: true })
  const db = await descargarObjeto(c, 'latest/caja.db.enc')
  const dbPath = join(destDir, 'caja.db.enc')
  writeFileSync(dbPath, db)
  try {
    const rec = await descargarObjeto(c, 'latest/caja.recovery.key')
    writeFileSync(join(destDir, 'caja.recovery.key'), rec)
  } catch {
    /* puede no existir si nunca se configuró recuperación; se usará la de esta PC */
  }
  return dbPath
}

/** Encola un archivo de copia (por nombre, dentro de backups/) para subir. */
export function encolarSubida(nombre: string): void {
  const c = leerCfg()
  if (!c) return
  if (!c.pendientes.includes(nombre)) {
    c.pendientes.push(nombre)
    guardarCfg(c)
  }
  void flushNube()
}

let subiendo = false

/** Reintenta subir lo pendiente + la copia "última". Best-effort, nunca lanza. */
export async function flushNube(): Promise<EstadoNube> {
  const c = leerCfg()
  if (!c || subiendo) return estadoNube()
  subiendo = true
  try {
    const restantes: string[] = []
    for (const nombre of c.pendientes) {
      const ruta = join(backupsDir(), nombre)
      try {
        if (existsSync(ruta)) await subirObjeto(c, `historial/${nombre}`, readFileSync(ruta))
      } catch {
        restantes.push(nombre)
      }
    }
    try {
      await subirUltima(c)
    } catch {
      /* la última se reintenta en el próximo ciclo */
    }
    c.pendientes = restantes
    if (restantes.length === 0) c.ultimo = new Date().toISOString()
    guardarCfg(c)
  } catch {
    /* best-effort */
  } finally {
    subiendo = false
  }
  return estadoNube()
}
