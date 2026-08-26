import { useEffect, useState } from 'react'
import { useSoundboardStore } from './store/soundboard'
import { SoundGrid } from './components/SoundGrid'
import { GlobalVolumeBar } from './components/GlobalVolumeBar'
import { StatusBadge } from './components/StatusBadge'
import { SettingsModal } from './components/SettingsModal'

function App() {
  const ready = useSoundboardStore((s) => s.ready)
  const errorMessage = useSoundboardStore((s) => s.errorMessage)
  const init = useSoundboardStore((s) => s.init)
  const importSounds = useSoundboardStore((s) => s.importSounds)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Starting up…
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-base-700 bg-base-850 px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Soundboard</h1>
          <StatusBadge />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void importSounds()}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Import
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="rounded-lg border border-base-600 px-3 py-1.5 text-sm text-slate-300 hover:border-base-500 hover:text-slate-100"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="border-b border-red-900/50 bg-red-950/40 px-6 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-6 py-5">
        <SoundGrid />
      </main>

      <GlobalVolumeBar />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export default App
