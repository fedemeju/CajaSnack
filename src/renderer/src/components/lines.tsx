import { useState } from 'react'
import type { LineaGasto, LineaMesa, LineaRubro } from '../../../shared/types'
import { formatMoney } from '../lib/format'
import { MoneyInput } from './MoneyInput'

interface BaseProps {
  disabled?: boolean
}

function Subtotal({ total, count }: { total: number; count: number }): JSX.Element | null {
  if (count < 2) return null
  return (
    <div className="subtotal">
      <span>
        Subtotal <span className="subtotal-count">({count})</span>
      </span>
      <span>{formatMoney(total)}</span>
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
  return (
    <button className="btn-add-soft" onClick={onClick}>
      <span aria-hidden>+</span> {label}
    </button>
  )
}

export function GastoEditor({
  items,
  onChange,
  disabled,
  medioPago = false
}: BaseProps & {
  items: LineaGasto[]
  onChange: (items: LineaGasto[]) => void
  /** Si es true, muestra "Medio de pago" (efectivo/mercado pago) en vez de "Persona". */
  medioPago?: boolean
}): JSX.Element {
  const total = items.reduce((a, l) => a + (l.monto || 0), 0)
  const [nuevo, setNuevo] = useState<number | null>(null)
  const vacio = (): LineaGasto =>
    medioPago
      ? { concepto: '', persona: '', monto: 0, medioPago: 'efectivo' }
      : { concepto: '', persona: '', monto: 0 }
  const upd = (i: number, patch: Partial<LineaGasto>): void => {
    onChange(items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  const agregar = (): void => {
    setNuevo(items.length)
    onChange([...items, vacio()])
  }
  return (
    <div className="line-list">
      {items.map((l, i) => (
        <div className="line-row" key={i}>
          <input
            className="text-input line-grow"
            placeholder="Concepto / Proveedor"
            disabled={disabled}
            autoFocus={i === nuevo}
            onFocus={() => i === nuevo && setNuevo(null)}
            value={l.concepto}
            onChange={(e) => upd(i, { concepto: e.target.value })}
          />
          {medioPago ? (
            <select
              className="text-input line-medio"
              disabled={disabled}
              value={l.medioPago ?? 'efectivo'}
              onChange={(e) => upd(i, { medioPago: e.target.value as 'efectivo' | 'mercadoPago' })}
            >
              <option value="efectivo">Efectivo</option>
              <option value="mercadoPago">Mercado Pago</option>
            </select>
          ) : (
            <input
              className="text-input line-medio"
              placeholder="Persona"
              disabled={disabled}
              value={l.persona}
              onChange={(e) => upd(i, { persona: e.target.value })}
            />
          )}
          <MoneyInput value={l.monto} disabled={disabled} onChange={(m) => upd(i, { monto: m })} />
          {!disabled && (
            <button
              className="row-del"
              title="Quitar"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && <AddButton onClick={agregar} label={items.length ? 'Agregar otro' : 'Agregar'} />}
      <Subtotal total={total} count={items.length} />
    </div>
  )
}

export function MesaEditor({
  items,
  onChange,
  disabled,
  placeholder = 'Mozo / Mesa'
}: BaseProps & {
  items: LineaMesa[]
  onChange: (items: LineaMesa[]) => void
  placeholder?: string
}): JSX.Element {
  const total = items.reduce((a, l) => a + (l.monto || 0), 0)
  const [nuevo, setNuevo] = useState<number | null>(null)
  const upd = (i: number, patch: Partial<LineaMesa>): void => {
    onChange(items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  const agregar = (): void => {
    setNuevo(items.length)
    onChange([...items, { detalle: '', monto: 0 }])
  }
  return (
    <div className="line-list">
      {items.map((l, i) => (
        <div className="line-row" key={i}>
          <input
            className="text-input line-grow"
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={i === nuevo}
            onFocus={() => i === nuevo && setNuevo(null)}
            value={l.detalle}
            onChange={(e) => upd(i, { detalle: e.target.value })}
          />
          <MoneyInput value={l.monto} disabled={disabled} onChange={(m) => upd(i, { monto: m })} />
          {!disabled && (
            <button
              className="row-del"
              title="Quitar"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && <AddButton onClick={agregar} label={items.length ? 'Agregar otra' : 'Agregar'} />}
      <Subtotal total={total} count={items.length} />
    </div>
  )
}

export function RubroEditor({
  items,
  onChange,
  disabled
}: BaseProps & {
  items: LineaRubro[]
  onChange: (items: LineaRubro[]) => void
}): JSX.Element {
  // El subtotal no cuenta los renglones marcados como "ya facturado".
  const total = items.reduce((a, l) => a + (l.facturado ? 0 : l.monto || 0), 0)
  const [nuevo, setNuevo] = useState<number | null>(null)
  const upd = (i: number, patch: Partial<LineaRubro>): void => {
    onChange(items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  const agregar = (): void => {
    setNuevo(items.length)
    onChange([...items, { concepto: '', paquetes: 0, cantidad: 0, monto: 0 }])
  }
  const num = (v: string): number => parseInt(v.replace(/\D/g, '') || '0', 10)
  return (
    <div className="line-list">
      {items.map((l, i) => (
        <div className="line-row line-row-rubro" key={i}>
          <input
            className="text-input line-grow"
            placeholder="Concepto"
            disabled={disabled}
            autoFocus={i === nuevo}
            onFocus={() => i === nuevo && setNuevo(null)}
            value={l.concepto}
            onChange={(e) => upd(i, { concepto: e.target.value })}
          />
          <label className="line-mini">
            <span>Paq.</span>
            <input
              className="text-input"
              inputMode="numeric"
              disabled={disabled}
              value={l.paquetes || ''}
              onChange={(e) => upd(i, { paquetes: num(e.target.value) })}
            />
          </label>
          <label className="line-mini">
            <span>Cant.</span>
            <input
              className="text-input"
              inputMode="numeric"
              disabled={disabled}
              value={l.cantidad || ''}
              onChange={(e) => upd(i, { cantidad: num(e.target.value) })}
            />
          </label>
          <MoneyInput value={l.monto} disabled={disabled} onChange={(m) => upd(i, { monto: m })} />
          <label className="line-chk" title="Marcá si este ya está facturado (no suma al total)">
            <input
              type="checkbox"
              checked={!!l.facturado}
              disabled={disabled}
              onChange={(e) => upd(i, { facturado: e.target.checked })}
            />
            Fact.
          </label>
          {!disabled && (
            <button
              className="row-del"
              title="Quitar"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && <AddButton onClick={agregar} label={items.length ? 'Agregar otro' : 'Agregar'} />}
      <Subtotal total={total} count={items.length} />
    </div>
  )
}

/** Pool: cuenta unidades (botones +/-) por un precio editable. */
export function PoolField({
  unidades,
  precio,
  onUnidades,
  onPrecio,
  disabled
}: {
  unidades: number
  precio: number
  onUnidades: (n: number) => void
  onPrecio: (n: number) => void
  disabled?: boolean
}): JSX.Element {
  const total = (unidades || 0) * (precio || 0)
  const [editaPrecio, setEditaPrecio] = useState(false)
  return (
    <div className="field pool-field">
      <label>Pool</label>
      <div className="pool-controls">
        <div className="stepper">
          <button
            className="stepper-btn"
            disabled={disabled}
            title="Quitar uno"
            onClick={() => onUnidades(Math.max(0, (unidades || 0) - 1))}
          >
            −
          </button>
          <input
            className="stepper-input"
            inputMode="numeric"
            disabled={disabled}
            value={unidades || 0}
            onChange={(e) => onUnidades(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
          />
          <button
            className="stepper-btn"
            disabled={disabled}
            title="Agregar uno"
            onClick={() => onUnidades((unidades || 0) + 1)}
          >
            +
          </button>
        </div>
        <span className="pool-op">×</span>
        {editaPrecio && !disabled ? (
          <div style={{ width: 120 }}>
            <MoneyInput
              value={precio}
              onChange={onPrecio}
              autoFocus
              onBlur={() => setEditaPrecio(false)}
            />
          </div>
        ) : (
          <span className="pool-precio">
            {formatMoney(precio)} c/u
            {!disabled && (
              <button className="pool-edit" title="Cambiar precio" onClick={() => setEditaPrecio(true)}>
                ✎
              </button>
            )}
          </span>
        )}
        <span className="pool-op">=</span>
        <b className="pool-total">{formatMoney(total)}</b>
      </div>
    </div>
  )
}

/** Fila simple etiqueta + monto. */
export function MoneyField({
  label,
  value,
  onChange,
  disabled
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <MoneyInput value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}
