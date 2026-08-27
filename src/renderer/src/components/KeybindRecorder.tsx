import { useEffect, useState } from 'react'
import { buildAccelerator, formatAccelerator, isModifierOnly } from '../utils/accelerator'

interface KeybindRecorderProps {
  value: string | null
  onSet: (accelerator: string | null) => Promise<{ ok: boolean; error?: string }>
  supported: boolean
}

export function KeybindRecorder({ value, onSet, supported }: KeybindRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return

    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      if (isModifierOnly(e)) return

      const attempt = buildAccelerator(e)
      if (attempt.error || !attempt.accelerator) {
        setError(attempt.error)
        return
      }

      setRecording(false)
      setError(null)
      void onSet(attempt.accelerator).then((result) => {
        if (!result.ok) setError(result.error ?? 'Could not set that shortcut.')
      })
    }

    // Capture phase on window: fires before this keydown can bubble to anything
    // else (like the edit menu's own Escape-to-close handler), so recording
    // safely swallows every key while active.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onSet])

  if (!supported) {
    return (
      <p className="rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
        Global shortcuts aren't available in this desktop session (common on Wayland). Use the Stream Deck /
        command-line trigger in Settings instead.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setError(null)
            setRecording(true)
          }}
          className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm font-mono transition-colors ${
            recording
              ? 'animate-pulse border-accent bg-accent-soft/40 text-accent-glow'
              : 'border-base-600 bg-base-950 text-slate-200 hover:border-base-500'
          }`}
        >
          {recording ? 'Press a key combo… (Esc to cancel)' : value ? formatAccelerator(value) : 'Click to record'}
        </button>
        {value && !recording && (
          <button
            onClick={() => void onSet(null)}
            title="Clear shortcut"
            className="rounded-lg border border-base-600 px-2.5 py-2 text-xs text-slate-400 hover:border-red-400 hover:text-red-400"
          >
            ✕
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
