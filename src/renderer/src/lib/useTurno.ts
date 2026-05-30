import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ApiResult,
  TipoTurno,
  Turno,
  TurnoMananaData,
  TurnoNocheData,
  Usuario
} from '../../../shared/types'
import { hoyISO } from './format'

type Data = TurnoMananaData | TurnoNocheData

export interface UseTurno<T> {
  // Selección
  fecha: string
  setFecha: (f: string) => void
  existente: Turno | null | undefined // undefined = cargando
  pendiente: Turno | null | undefined // turno abierto sin cerrar de otra fecha
  abrir: () => Promise<void>
  // Edición
  entrado: boolean
  turno: Turno | null
  readOnly: boolean
  data: T
  setData: (patch: Partial<T>) => void
  // Estado de guardado
  guardando: boolean
  guardadoLabel: string
  error: string
  cerrar: () => Promise<ApiResult<Turno>>
  reabrir: () => Promise<ApiResult<Turno>>
  actualizarTurno: (t: Turno) => void
  volver: () => void
}

export function useTurno<T extends Data>(
  tipo: TipoTurno,
  user: Usuario,
  vacio: () => T,
  normalizar?: (raw: T) => T
): UseTurno<T> {
  const fundir = (raw: unknown): T => {
    const merged = { ...vacio(), ...(raw as T) }
    return normalizar ? normalizar(merged) : merged
  }
  const [fecha, setFecha] = useState(hoyISO())
  const [existente, setExistente] = useState<Turno | null | undefined>(undefined)
  const [pendiente, setPendiente] = useState<Turno | null | undefined>(undefined)
  const [turno, setTurno] = useState<Turno | null>(null)
  const [data, setDataRaw] = useState<T>(vacio())
  const [guardando, setGuardando] = useState(false)
  const [guardadoLabel, setGuardadoLabel] = useState('')
  const [error, setError] = useState('')

  const entrado = turno !== null
  const readOnly = turno?.estado === 'cerrado'

  // Revisar si ya existe un turno para la fecha elegida (pantalla de selección)
  useEffect(() => {
    if (entrado) return
    let vivo = true
    setExistente(undefined)
    window.api.obtenerTurnoPorFecha(fecha, tipo).then((res) => {
      if (vivo) setExistente(res.ok ? res.data : null)
    })
    return () => {
      vivo = false
    }
  }, [fecha, tipo, entrado])

  // Revisar si quedó un turno abierto sin cerrar (de cualquier fecha) de este tipo
  useEffect(() => {
    if (entrado) return
    let vivo = true
    setPendiente(undefined)
    window.api.turnoAbiertoPendiente(tipo).then((res) => {
      if (!vivo) return
      const p = res.ok ? res.data : null
      setPendiente(p)
      // Mostrar la fecha del turno que quedó sin cerrar (es el que se va a abrir)
      if (p) setFecha(p.fecha)
    })
    return () => {
      vivo = false
    }
  }, [tipo, entrado])

  const setData = useCallback((patch: Partial<T>): void => {
    setDataRaw((d) => ({ ...d, ...patch }))
  }, [])

  const abrir = useCallback(async (): Promise<void> => {
    setError('')
    const exist = await window.api.obtenerTurnoPorFecha(fecha, tipo)
    if (exist.ok && exist.data) {
      setTurno(exist.data)
      setDataRaw(fundir(exist.data.data))
      setGuardadoLabel(exist.data.estado === 'cerrado' ? 'Turno cerrado' : 'Turno abierto')
      return
    }
    // Antes de crear uno nuevo, si quedó otro turno abierto sin cerrar, abrir ese.
    const pend = await window.api.turnoAbiertoPendiente(tipo)
    if (pend.ok && pend.data) {
      setFecha(pend.data.fecha)
      setTurno(pend.data)
      setDataRaw(fundir(pend.data.data))
      setGuardadoLabel('Turno abierto')
      return
    }
    const creado = await window.api.guardarTurno({
      fecha,
      tipo,
      usuarioId: user.id,
      data: vacio(),
      cerrar: false
    })
    if (creado.ok) {
      setTurno(creado.data)
      setDataRaw(vacio())
      setGuardadoLabel('Turno abierto')
    } else {
      setError(creado.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, tipo, user.id])

  // Autoguardado con debounce: cada cambio en data se persiste solo
  const saltarPrimero = useRef(true)
  useEffect(() => {
    if (!entrado || readOnly || !turno) return
    if (saltarPrimero.current) {
      saltarPrimero.current = false
      return
    }
    setGuardando(true)
    const h = setTimeout(async () => {
      const res = await window.api.guardarTurno({
        id: turno.id,
        fecha: turno.fecha,
        tipo,
        usuarioId: user.id,
        data,
        cerrar: false
      })
      setGuardando(false)
      if (res.ok) {
        setTurno(res.data)
        setGuardadoLabel('Guardado ' + new Date().toLocaleTimeString('es-AR'))
      } else {
        setError(res.error)
      }
    }, 700)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Avisar al proceso principal si hay un guardado pendiente, para advertir al cerrar.
  useEffect(() => {
    window.api.notificarGuardando(guardando)
  }, [guardando])
  useEffect(() => {
    return () => window.api.notificarGuardando(false)
  }, [])

  const cerrar = useCallback(async (): Promise<ApiResult<Turno>> => {
    if (!turno) return { ok: false, error: 'No hay turno abierto.' }
    const res = await window.api.guardarTurno({
      id: turno.id,
      fecha: turno.fecha,
      tipo,
      usuarioId: user.id,
      data,
      cerrar: true
    })
    if (res.ok) {
      setTurno(res.data)
      setGuardadoLabel('Turno cerrado')
    }
    return res
  }, [turno, data, tipo, user.id])

  const reabrir = useCallback(async (): Promise<ApiResult<Turno>> => {
    if (!turno) return { ok: false, error: 'No hay turno para reabrir.' }
    const res = await window.api.reabrirTurno(turno.id)
    if (res.ok) {
      setTurno(res.data)
      saltarPrimero.current = false
      setGuardadoLabel('Turno reabierto')
    } else {
      setError(res.error)
    }
    return res
  }, [turno])

  const actualizarTurno = useCallback((t: Turno): void => {
    setTurno(t)
  }, [])

  const volver = useCallback((): void => {
    setTurno(null)
    setDataRaw(vacio())
    saltarPrimero.current = true
    setGuardadoLabel('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    fecha,
    setFecha,
    existente,
    pendiente,
    abrir,
    entrado,
    turno,
    readOnly,
    data,
    setData,
    guardando,
    guardadoLabel,
    error,
    cerrar,
    reabrir,
    actualizarTurno,
    volver
  }
}
