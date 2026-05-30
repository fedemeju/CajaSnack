import bcrypt from 'bcryptjs'
import { all, persist, run } from './db'

interface SeedUser {
  usuario: string
  nombre: string
  rol: string
  password: string
}

const DEFAULTS: SeedUser[] = [
  { usuario: 'admin', nombre: 'Administrador', rol: 'admin', password: 'admin1234' },
  { usuario: 'manana', nombre: 'Turno Mañana', rol: 'manana', password: 'manana123' },
  { usuario: 'tarde', nombre: 'Turno Tarde', rol: 'tarde', password: 'tarde123' }
]

/** Crea los 3 usuarios por defecto si la tabla está vacía. */
export function seedUsuarios(): void {
  const existentes = all('SELECT id FROM usuarios')
  if (existentes.length > 0) return
  for (const u of DEFAULTS) {
    run('INSERT INTO usuarios (usuario, nombre, rol, password_hash) VALUES (?, ?, ?, ?)', [
      u.usuario,
      u.nombre,
      u.rol,
      bcrypt.hashSync(u.password, 10)
    ])
  }
  persist()
}
