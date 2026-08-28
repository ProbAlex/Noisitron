import { useEffect, useState } from 'react'
import { useSoundboardStore } from '../store/soundboard'
import { VolumeSlider } from './VolumeSlider'

interface SettingsModalProps {
  onClose: () => void
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>
}

function CopyableCommand({ command }: { command: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-950 px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-slate-300">
        {command ?? 'Resolving…'}
      </code>
      <button
        disabled={!command}
        onClick={() => {
          if (!command) return
          void window.api.app.copyToClipboard(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        className="shrink-0 rounded-md border border-base-600 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-base-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
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
  const refreshDevices = useSoundboardStore((s) => s.refreshDevices)
  const reconnectVirtualMic = useSoundboardStore((s) => s.reconnectVirtualMic)
  const sounds = useSoundboardStore((s) => s.sounds)
  const globalShortcutsSupported = useSoundboardStore((s) => s.globalShortcutsSupported)

  const [micVolume, setMicVolume] = useState(micStatus?.micLoopbackVolumePercent ?? 100)
  const [refreshing, setRefreshing] = useState(false)
  const [execPath, setExecPath] = useState<string | null>(null)

  useEffect(() => {
    if (micStatus) setMicVolume(micStatus.micLoopbackVolumePercent)
  }, [micStatus?.micLoopbackVolumePercent])

  useEffect(() => {
    void window.api.app.getExecPath().then(setExecPath)
  }, [])

  const exampleSoundName = sounds[0]?.name ?? 'Your Sound Name'

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-6 overflow-y-auto rounded-2xl border border-base-700 bg-base-850 p-6 shadow-2xl shadow-black/50 animate-pop-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionHeading>Audio routing</SectionHeading>
            <button
              onClick={async () => {
                setRefreshing(true)
                await refreshDevices()
                setRefreshing(false)
              }}
              className="text-[11px] font-medium text-accent hover:text-accent-hover disabled:opacity-50"
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh devices'}
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
              unit="percent"
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

          <button
            onClick={() => void reconnectVirtualMic()}
            className="self-start text-[11px] font-medium text-accent hover:text-accent-hover"
          >
            Reconnect virtual microphone
          </button>

          <div className="rounded-lg border border-base-700 bg-base-900 p-3 text-xs leading-relaxed text-slate-400">
            In Discord, open <span className="text-slate-300">Settings → Voice &amp; Video</span> and set your
            Input Device to{' '}
            <span className="font-mono text-slate-200">Monitor of Noisitron_Virtual_Mic</span>. Discord will
            then hear your microphone and any sound you click here, mixed together.
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-base-700 pt-4">
          <SectionHeading>Library</SectionHeading>
          <button
            onClick={() => void window.api.app.openSoundsFolder()}
            className="self-start rounded-lg border border-base-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-base-500 hover:text-slate-100"
          >
            Open sounds folder
          </button>
        </div>

        <div className="flex flex-col gap-3 border-t border-base-700 pt-4">
          <SectionHeading>Stream Deck / command line</SectionHeading>
          <p className="text-xs leading-relaxed text-slate-400">
            Point a Stream Deck "System: Open" action (or any launcher) at Noisitron with these flags. If
            Noisitron is already running, it plays instantly in the running app instead of opening a new window.
          </p>
          <CopyableCommand command={execPath ? `${execPath} --play="${exampleSoundName}"` : null} />
          <CopyableCommand command={execPath ? `${execPath} --list-sounds` : null} />
          <p className="text-xs text-slate-500">
            <code className="text-slate-400">--list-sounds</code> prints every sound's exact name (and id) to
            the terminal so you can copy it into a Stream Deck button. A global keybind for a sound is set from
            its right-click menu instead of the command line.
          </p>
          {!globalShortcutsSupported && (
            <p className="rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
              Global keybinds aren't available in this desktop session (common on Wayland) — right-click
              shortcuts won't register. The Stream Deck / CLI trigger above works regardless.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-base-700 pt-4">
          <SectionHeading>Application</SectionHeading>
          <p className="text-xs leading-relaxed text-slate-400">
            Closing this window (the X button, or a window manager close shortcut) minimizes
            Noisitron to the system tray instead of quitting — keybinds and the Stream Deck / CLI
            trigger keep working. Use the tray icon or the button below to fully quit.
          </p>
          <button
            onClick={() => void window.api.app.quit()}
            className="self-start rounded-lg border border-base-600 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-red-400 hover:text-red-400"
          >
            Quit Noisitron
          </button>
        </div>
      </div>
    </div>
  )
}
