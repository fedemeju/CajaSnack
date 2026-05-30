import { app, safeStorage } from 'electron'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IV_LEN = 12
const TAG_LEN = 16

function keyFilePath(): string {
  return join(app.getPath('userData'), 'caja.key')
}

/**
 * Devuelve la clave AES-256 de la base de datos. La primera vez la genera al
 * azar y la guarda protegida con el cifrado del sistema operativo (DPAPI en
 * Windows, vía safeStorage). Si safeStorage no estuviera disponible, cae a un
 * almacenamiento en base64 (menos seguro) para no romper la app.
 */
export function getDbKey(): Buffer {
  const file = keyFilePath()
  const canProtect = safeStorage.isEncryptionAvailable()

  if (existsSync(file)) {
    const stored = readFileSync(file)
    if (canProtect) {
      const hex = safeStorage.decryptString(stored)
      return Buffer.from(hex, 'hex')
    }
    // Fallback: guardado en base64 plano (prefijo "b64:")
    const txt = stored.toString('utf8')
    return Buffer.from(txt.replace(/^b64:/, ''), 'base64')
  }

  const key = randomBytes(32)
  if (canProtect) {
    writeFileSync(file, safeStorage.encryptString(key.toString('hex')))
  } else {
    writeFileSync(file, 'b64:' + key.toString('base64'), 'utf8')
  }
  return key
}

export function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

export function decrypt(blob: Buffer, key: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LEN)
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = blob.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()])
}
