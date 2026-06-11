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
  cerrar: (nombreCajero: string) => Promise<ApiResult<Turno>>
  reabrir: (password: string) => Promise<ApiResult<Turno>>
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

  // CLAVE anti-pérdida: el autoguardado SOLO se dispara tras una edición real del
  // usuario (setData), nunca al cargar/recargar datos. Así una pantalla recién
  // cargada (o vacía por una recarga) jamás puede pisar lo guardado.
  const sucio = useRef(false)

  // Si quedó un turno abierto sin cerrar, entrar DIRECTO a él con sus datos
  // cargados. Evita la pantalla de selección y que el usuario vea campos vacíos
  // y crea que "se perdió" lo cargado.
  useEffect(() => {
    if (entrado || !pendiente) return
    setTurno(pendiente)
    setDataRaw(fundir(pendiente.data as T))
    sucio.current = false
    setFecha(pendiente.fecha)
    setGuardadoLabel('Turno abierto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendiente, entrado])

  const setData = useCallback((patch: Partial<T>): void => {
    sucio.current = true // marca edición del usuario → habilita el autoguardado
    setDataRaw((d) => ({ ...d, ...patch }))
  }, [])

  const abrir = useCallback(async (): Promise<void> => {
    setError('')
    const exist = await window.api.obtenerTurnoPorFecha(fecha, tipo)
    if (exist.ok && exist.data) {
      setTurno(exist.data)
      setDataRaw(fundir(exist.data.data))
      sucio.current = false
      setGuardadoLabel(exist.data.estado === 'cerrado' ? 'Turno cerrado' : 'Turno abierto')
      return
    }
    // Antes de crear uno nuevo, si quedó otro turno abierto sin cerrar, abrir ese.
    const pend = await window.api.turnoAbiertoPendiente(tipo)
    if (pend.ok && pend.data) {
      setFecha(pend.data.fecha)
      setTurno(pend.data)
      setDataRaw(fundir(pend.data.data))
      sucio.current = false
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
      sucio.current = false
      setGuardadoLabel('Turno abierto')
    } else {
      setError(creado.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, tipo, user.id])

  // Autoguardado con debounce: solo si el usuario editó (sucio). Las cargas
  // (abrir/auto-resume/volver) ponen sucio=false, así nunca disparan un guardado.
  useEffect(() => {
    if (!entrado || readOnly || !turno || !sucio.current) return
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

  const cerrar = useCallback(
    async (nombreCajero: string): Promise<ApiResult<Turno>> => {
      if (!turno) return { ok: false, error: 'No hay turno abierto.' }
      const dataCierre = { ...data, cerradoPor: nombreCajero } as T
      const res = await window.api.guardarTurno({
        id: turno.id,
        fecha: turno.fecha,
        tipo,
        usuarioId: user.id,
        data: dataCierre,
        cerrar: true
      })
      if (res.ok) {
        setTurno(res.data)
        setDataRaw(dataCierre)
        setGuardadoLabel('Turno cerrado')
      }
      return res
    },
    [turno, data, tipo, user.id]
  )

  const reabrir = useCallback(async (password: string): Promise<ApiResult<Turno>> => {
    if (!turno) return { ok: false, error: 'No hay turno para reabrir.' }
    const res = await window.api.reabrirTurno(turno.id, password)
    if (res.ok) {
      setTurno(res.data)
      sucio.current = false
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
    sucio.current = false
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
