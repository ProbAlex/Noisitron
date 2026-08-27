import { useSoundboardStore } from '../store/soundboard'

export function StatusBadge() {
  const micStatus = useSoundboardStore((s) => s.micStatus)
  const errorMessage = useSoundboardStore((s) => s.errorMessage)
  const reconnect = useSoundboardStore((s) => s.reconnectVirtualMic)

  const active = micStatus?.active && !errorMessage

  return (
    <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-850 px-3 py-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]' : 'bg-red-500'}`}
        aria-hidden
      />
      <span className="text-slate-300">
        {active ? 'Virtual mic ready' : errorMessage ? 'Virtual mic error' : 'Virtual mic offline'}
      </span>
      {!active && (
        <button
          onClick={() => void reconnect()}
          className="ml-1 rounded bg-base-700 px-2 py-0.5 font-medium text-slate-200 hover:bg-base-600"
        >
          Reconnect
        </button>
      )}
    </div>
  )
}
