import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Opts {
  mensaje: string
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}

type ConfirmFn = (o: Opts | string) => Promise<boolean>

const Ctx = createContext<ConfirmFn>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }): JSX.Element {
  const [estado, setEstado] = useState<{ opts: Opts; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    const opts = typeof o === 'string' ? { mensaje: o } : o
    return new Promise<boolean>((resolve) => setEstado({ opts, resolve }))
  }, [])

  const cerrar = (v: boolean): void => {
    estado?.resolve(v)
    setEstado(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {estado && (
        <div className="modal-overlay" onClick={() => cerrar(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-msg">{estado.opts.mensaje}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => cerrar(false)}>
                {estado.opts.cancelar ?? 'Cancelar'}
              </button>
              <button
                className={`btn ${estado.opts.peligro ? 'btn-danger' : 'btn-primary'}`}
                autoFocus
                onClick={() => cerrar(true)}
              >
                {estado.opts.confirmar ?? 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  return useContext(Ctx)
}
