import { useSoundboardStore } from '../store/soundboard'
import { VolumeSlider } from './VolumeSlider'

export function GlobalVolumeBar() {
  const globalMicVolume = useSoundboardStore((s) => s.globalMicVolume)
  const globalHeadphoneVolume = useSoundboardStore((s) => s.globalHeadphoneVolume)
  const setGlobalMicVolume = useSoundboardStore((s) => s.setGlobalMicVolume)
  const setGlobalHeadphoneVolume = useSoundboardStore((s) => s.setGlobalHeadphoneVolume)
  const activeSoundIds = useSoundboardStore((s) => s.activeSoundIds)
  const stopSound = useSoundboardStore((s) => s.stopSound)
  const sounds = useSoundboardStore((s) => s.sounds)

  function stopAll(): void {
    for (const id of activeSoundIds) stopSound(id)
  }

  return (
    <div className="flex flex-wrap items-center gap-6 border-t border-base-700 bg-base-850/80 px-6 py-4 backdrop-blur">
      <div className="min-w-[220px] flex-1">
        <VolumeSlider
          label="🎙 Soundboard → Mic"
          value={globalMicVolume}
          onChange={setGlobalMicVolume}
        />
      </div>
      <div className="min-w-[220px] flex-1">
        <VolumeSlider
          label="🎧 Headphones"
          value={globalHeadphoneVolume}
          onChange={setGlobalHeadphoneVolume}
        />
      </div>
      <button
        onClick={stopAll}
        disabled={activeSoundIds.size === 0}
        className="rounded-lg border border-base-600 px-4 py-2 text-sm font-medium text-slate-300 hover:border-red-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop all
      </button>
      {sounds.length > 0 && (
        <span className="text-xs text-slate-500">
          {activeSoundIds.size > 0 ? `${activeSoundIds.size} playing` : ''}
        </span>
      )}
    </div>
  )
}
