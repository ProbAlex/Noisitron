interface VolumeSliderProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  compact?: boolean
}

export function VolumeSlider({
  value,
  onChange,
  min = 0,
  max = 1.5,
  step = 0.01,
  label,
  compact = false
}: VolumeSliderProps) {
  const pct = Math.round((value / (max === 1.5 ? 1 : max)) * 100)
  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      {label && !compact && (
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span>{label}</span>
          <span className="tabular-nums text-slate-500">{pct}%</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={compact ? 'w-24' : 'w-full'}
      />
      {compact && <span className="w-9 shrink-0 tabular-nums text-xs text-slate-500">{pct}%</span>}
    </div>
  )
}
