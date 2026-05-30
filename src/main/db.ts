import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type { BackupInfo } from '../shared/types'
import { decrypt, encrypt, getDbKey } from './crypto'

/** Cuántas copias conservar en la carpeta de backups (las más viejas se borran). */
const MAX_BACKUPS = 60

let SQL: SqlJsStatic
let db: Database
let key: Buffer

function dbFilePath(): string {
  return join(app.getPath('userData'), 'caja.db.enc')
}

function backupsDir(): string {
  const dir = join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function wasmPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'sql-wasm.wasm')
    : join(app.getAppPath(), 'resources', 'sql-wasm.wasm')
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS turnos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  usuario_id INTEGER NOT NULL,
  estado TEXT NOT NULL,
  data TEXT NOT NULL,
  aprobado_por INTEGER,
  aprobado_at TEXT,
  creado_at TEXT NOT NULL,
  actualizado_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`

export async function initDb(): Promise<void> {
  key = getDbKey()
  backupsDir() // garantiza que la carpeta de copias exista desde el arranque
  const wasmBuf = readFileSync(wasmPath())
  const wasmBinary = wasmBuf.buffer.slice(
    wasmBuf.byteOffset,
    wasmBuf.byteOffset + wasmBuf.byteLength
  )
  SQL = await initSqlJs({ wasmBinary })

  const file = dbFilePath()
  if (existsSync(file)) {
    const decrypted = decrypt(readFileSync(file), key)
    db = new SQL.Database(new Uint8Array(decrypted))
  } else {
    db = new SQL.Database()
  }
  db.run(SCHEMA)
  migrarColumnas()
  persist()
}

/** Agrega columnas nuevas a bases ya existentes (CREATE TABLE IF NOT EXISTS no las altera). */
function migrarColumnas(): void {
  const cols = db.exec("PRAGMA table_info('turnos')")
  const nombres = cols.length ? cols[0].values.map((v) => String(v[1])) : []
  if (!nombres.includes('firma_log')) {
    db.run('ALTER TABLE turnos ADD COLUMN firma_log TEXT')
  }
}

/** Guarda la base cifrada en disco de forma atómica (temp + rename). */
export function persist(): void {
  const data = Buffer.from(db.export())
  const blob = encrypt(data, key)
  const file = dbFilePath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, blob)
  renameSync(tmp, file)
}

/** Copia la base cifrada actual a la carpeta de backups con marca de tiempo. */
export function backup(etiqueta = ''): void {
  const file = dbFilePath()
  if (!existsSync(file)) return
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const suf = etiqueta ? `_${etiqueta}` : ''
  copyFileSync(file, join(backupsDir(), `caja_${ts}${suf}.db.enc`))
  rotarBackups()
}

/**
 * Crea una copia del día si todavía no existe. Es barato (solo chequea si el
 * archivo de hoy ya está), así que se puede llamar en cada guardado para
 * garantizar al menos un backup diario sin inundar la carpeta.
 */
export function backupDiario(): void {
  const file = dbFilePath()
  if (!existsSync(file)) return
  const hoy = new Date().toLocaleDateString('en-CA')
  const dest = join(backupsDir(), `caja_diario_${hoy}.db.enc`)
  if (existsSync(dest)) return
  copyFileSync(file, dest)
  rotarBackups()
}

/** Borra las copias más viejas dejando solo las MAX_BACKUPS más recientes. */
function rotarBackups(): void {
  const dir = backupsDir()
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('caja_') && f.endsWith('.db.enc'))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const { f } of files.slice(MAX_BACKUPS)) {
    try {
      unlinkSync(join(dir, f))
    } catch {
      /* si no se puede borrar uno, seguimos */
    }
  }
}

/** Lista las copias guardadas (más recientes primero). */
export function listarBackups(): BackupInfo[] {
  const dir = backupsDir()
  return readdirSync(dir)
    .filter((f) => f.startsWith('caja_') && f.endsWith('.db.enc'))
    .map((f) => {
      const st = statSync(join(dir, f))
      return { nombre: f, tamano: st.size, fecha: st.mtime.toISOString() }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Ruta de la carpeta de backups (para abrirla en el explorador). */
export function backupsPath(): string {
  return backupsDir()
}

/** Copia la base cifrada actual a la ruta destino elegida por el usuario. */
export function exportarCopia(destPath: string): void {
  persist()
  copyFileSync(dbFilePath(), destPath)
}

/**
 * Restaura la base desde un archivo de copia. El archivo debe poder
 * descifrarse con la clave de ESTA PC y ser una base válida de CajaSnack.
 * Antes de pisar la base actual, deja un resguardo de seguridad.
 */
export function restaurarDesdeArchivo(ruta: string): void {
  if (!existsSync(ruta)) throw new Error('El archivo seleccionado no existe.')
  let restored: Buffer
  try {
    restored = decrypt(readFileSync(ruta), key)
  } catch {
    throw new Error('No se pudo abrir la copia (puede ser de otra PC/usuario de Windows, o estar dañada).')
  }
  let candidata: Database
  try {
    candidata = new SQL.Database(new Uint8Array(restored))
    candidata.run('SELECT 1 FROM turnos LIMIT 1')
    candidata.run('SELECT 1 FROM usuarios LIMIT 1')
  } catch {
    throw new Error('La copia no parece una base de CajaSnack válida.')
  }
  backup('antes_de_restaurar')
  db.close()
  db = candidata
  persist()
}

/** Restaura una copia interna (de la carpeta de backups) por nombre de archivo. */
export function restaurarBackupInterno(nombre: string): void {
  if (nombre.includes('/') || nombre.includes('\\') || nombre.includes('..')) {
    throw new Error('Nombre de copia inválido.')
  }
  restaurarDesdeArchivo(join(backupsDir(), nombre))
}

type Row = Record<string, unknown>

export function all(sql: string, params: unknown[] = []): Row[] {
  const stmt = db.prepare(sql)
  stmt.bind(params as never)
  const rows: Row[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function get(sql: string, params: unknown[] = []): Row | undefined {
  return all(sql, params)[0]
}

export function run(sql: string, params: unknown[] = []): void {
  db.run(sql, params as never)
}

export function lastInsertId(): number {
  const r = get('SELECT last_insert_rowid() AS id')
  return Number(r?.id ?? 0)
}
