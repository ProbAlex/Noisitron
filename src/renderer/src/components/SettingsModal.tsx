import { useState } from 'react'
import { useSoundboardStore } from '../store/soundboard'
import { VolumeSlider } from './VolumeSlider'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const sourceDevices = useSoundboardStore((s) => s.sourceDevices)
  const sinkDevices = useSoundboardStore((s) => s.sinkDevices)
  const micSourceName = useSoundboardStore((s) => s.micSourceName)
  const headphoneSinkName = useSoundboardStore((s) => s.headphoneSinkName)
  const setMicSourceName = useSoundboardStore((s) => s.setMicSourceName)
  const setHeadphoneSinkName = useSoundboardStore((s) => s.setHeadphoneSinkName)
  const micStatus = useSoundboardStore((s) => s.micStatus)
  const setMicInputVolumePercent = useSoundboardStore((s) => s.setMicInputVolumePercent)

  const [micVolume, setMicVolume] = useState(micStatus?.micLoopbackVolumePercent ?? 100)

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-base-700 bg-base-850 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-300">Microphone (passed through to Discord)</span>
          <select
            value={micSourceName ?? ''}
            onChange={(e) => void setMicSourceName(e.target.value || null)}
            className="rounded-lg border border-base-600 bg-base-950 px-3 py-2 text-slate-200 outline-none focus:border-accent"
          >
            <option value="">None selected</option>
            {sourceDevices.map((d) => (
              <option key={d.name} value={d.name}>
                {d.description}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-300">Mic input level</span>
          <VolumeSlider
            value={micVolume}
            min={0}
            max={150}
            step={1}
            onChange={(v) => {
              setMicVolume(v)
              void setMicInputVolumePercent(v)
            }}
          />
          <span className="text-xs text-slate-500">Raw gain on your voice before it reaches Discord.</span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-300">Headphone / monitor output</span>
          <select
            value={headphoneSinkName ?? ''}
            onChange={(e) => void setHeadphoneSinkName(e.target.value || null)}
            className="rounded-lg border border-base-600 bg-base-950 px-3 py-2 text-slate-200 outline-none focus:border-accent"
          >
            <option value="">System default</option>
            {sinkDevices.map((d) => (
              <option key={d.name} value={d.name}>
                {d.description}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-lg border border-base-700 bg-base-900 p-3 text-xs leading-relaxed text-slate-400">
          In Discord, open <span className="text-slate-300">Settings → Voice &amp; Video</span> and set your Input
          Device to <span className="font-mono text-slate-200">Monitor of Soundboard_Virtual_Mic</span>. Discord
          will then hear your microphone and any sound you click here, mixed together.
        </div>
      </div>
    </div>
  )
}
