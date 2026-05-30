import { useState } from 'react'
import { formatNumber, parseMoney } from '../lib/format'

interface Props {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  onBlur?: () => void
  autoFocus?: boolean
}

export function MoneyInput({ value, onChange, disabled, onBlur, autoFocus }: Props): JSX.Element {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')
  const display = focused
    ? raw
      ? formatNumber(parseInt(raw, 10))
      : ''
    : value
      ? formatNumber(value)
      : ''

  return (
    <div className="money-input">
      <span>$</span>
      <input
        inputMode="numeric"
        disabled={disabled}
        value={display}
        placeholder="0"
        autoFocus={autoFocus}
        onFocus={() => {
          setRaw(value ? String(value) : '')
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
          onBlur?.()
        }}
        onChange={(e) => {
          setRaw(e.target.value.replace(/[^\d]/g, ''))
          onChange(parseMoney(e.target.value))
        }}
      />
    </div>
  )
}
