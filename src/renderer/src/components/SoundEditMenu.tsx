import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSoundboardStore } from '../store/soundboard'
import { VolumeSlider } from './VolumeSlider'
import { KeybindRecorder } from './KeybindRecorder'

const QUICK_EMOJI = [
  '😂', '🔥', '💀', '🎉', '🚨', '📢', '🐍', '📯', '🥁', '🎶',
  '🔔', '⚡', '🎯', '👻', '🤖', '💥', '🧨', '🐸', '🦆', '🎮'
]

export function SoundEditMenu() {
  const contextMenu = useSoundboardStore((s) => s.contextMenu)
  const closeSoundMenu = useSoundboardStore((s) => s.closeSoundMenu)
  const sound = useSoundboardStore((s) => s.sounds.find((x) => x.id === contextMenu?.soundId))
  const folders = useSoundboardStore((s) => s.folders)
  const globalShortcutsSupported = useSoundboardStore((s) => s.globalShortcutsSupported)

  const renameSound = useSoundboardStore((s) => s.renameSound)
  const setSoundVolume = useSoundboardStore((s) => s.setSoundVolume)
  const setSoundEmoji = useSoundboardStore((s) => s.setSoundEmoji)
  const pickSoundImage = useSoundboardStore((s) => s.pickSoundImage)
  const clearSoundIcon = useSoundboardStore((s) => s.clearSoundIcon)
  const setSoundKeybind = useSoundboardStore((s) => s.setSoundKeybind)
  const setSoundFolder = useSoundboardStore((s) => s.setSoundFolder)
  const removeSound = useSoundboardStore((s) => s.removeSound)
  const openTrimEditor = useSoundboardStore((s) => s.openTrimEditor)

  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [draftName, setDraftName] = useState(sound?.name ?? '')
  const [customEmoji, setCustomEmoji] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  useEffect(() => {
    setDraftName(sound?.name ?? '')
    setCustomEmoji('')
    setConfirmingRemove(false)
  }, [sound?.id])

  useEffect(() => {
    if (!contextMenu) return
    if (!sound) closeSoundMenu()
  }, [contextMenu, sound, closeSoundMenu])

  useEffect(() => {
    if (!contextMenu) return
    // Bubble phase (not focus-dependent): reliably closes the menu regardless of which
    // control inside it currently has focus. KeybindRecorder's capture-phase listener
    // swallows Escape first while actively recording, so this only fires otherwise.
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeSoundMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu, closeSoundMenu])

  useLayoutEffect(() => {
    if (!contextMenu || !panelRef.current) return
    panelRef.current.focus()
    const rect = panelRef.current.getBoundingClientRect()
    const margin = 10
    const left = Math.min(Math.max(margin, contextMenu.x), window.innerWidth - rect.width - margin)
    const top = Math.min(Math.max(margin, contextMenu.y), window.innerHeight - rect.height - margin)
    setPos({ left, top })
  }, [contextMenu])

  if (!contextMenu || !sound) return null

  function commitName(): void {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== sound!.name) renameSound(sound!.id, trimmed)
  }

  function commitCustomEmoji(): void {
    const trimmed = customEmoji.trim()
    if (trimmed) void setSoundEmoji(sound!.id, trimmed)
    setCustomEmoji('')
  }

  return (
    <div className="fixed inset-0 z-30" onClick={closeSoundMenu}>
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={pos ? { left: pos.left, top: pos.top } : { left: contextMenu.x, top: contextMenu.y, visibility: 'hidden' }}
        className="fixed z-40 flex w-72 flex-col gap-4 rounded-2xl border border-base-700 bg-base-850 p-4 shadow-2xl shadow-black/50 outline-none animate-pop-in"
      >
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
          className="rounded-lg border border-base-600 bg-base-950 px-3 py-1.5 text-sm font-medium text-slate-100 outline-none focus:border-accent"
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-400">Icon</span>
          <div className="grid grid-cols-10 gap-1">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                onClick={() => void setSoundEmoji(sound!.id, emoji)}
                className={`flex h-6 w-6 items-center justify-center rounded text-base transition-colors hover:bg-base-700 ${
                  sound!.emoji === emoji ? 'bg-accent-soft ring-1 ring-accent' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              onBlur={commitCustomEmoji}
              onKeyDown={(e) => e.key === 'Enter' && commitCustomEmoji()}
              placeholder="Custom emoji"
              className="w-24 rounded-lg border border-base-600 bg-base-950 px-2 py-1 text-center text-sm text-slate-100 outline-none focus:border-accent"
            />
            <button
              onClick={() => void pickSoundImage(sound!.id)}
              className="flex-1 rounded-lg border border-base-600 px-2 py-1 text-xs font-medium text-slate-300 hover:border-base-500 hover:text-slate-100"
            >
              Upload image
            </button>
            <button
              disabled={!sound!.emoji && !sound!.imagePath}
              onClick={() => void clearSoundIcon(sound!.id)}
              className="rounded-lg border border-base-600 px-2 py-1 text-xs text-slate-400 hover:border-red-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400">Volume</span>
          <VolumeSlider value={sound.volume} onChange={(v) => setSoundVolume(sound!.id, v)} />
        </div>

        <button
          onClick={() => openTrimEditor(sound!.id)}
          className="rounded-lg border border-base-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-base-500 hover:text-slate-100"
        >
          ✂ Trim sound
        </button>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400">Keybind</span>
          <KeybindRecorder
            value={sound.keybind}
            onSet={(accel) => setSoundKeybind(sound!.id, accel)}
            supported={globalShortcutsSupported}
          />
        </div>

        {folders.length > 0 && (
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-slate-400">Folder</span>
            <select
              value={sound.folderId ?? ''}
              onChange={(e) => void setSoundFolder(sound!.id, e.target.value || null)}
              className="rounded-lg border border-base-600 bg-base-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-accent"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="border-t border-base-700 pt-3">
          <button
            onClick={() => {
              if (!confirmingRemove) {
                setConfirmingRemove(true)
                return
              }
              void removeSound(sound!.id)
              closeSoundMenu()
            }}
            onBlur={() => setConfirmingRemove(false)}
            className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              confirmingRemove
                ? 'border-red-400 bg-red-500/20 text-red-300'
                : 'border-base-600 text-slate-400 hover:border-red-400 hover:text-red-400'
            }`}
          >
            {confirmingRemove ? 'Click again to remove' : 'Remove sound'}
          </button>
        </div>
      </div>
    </div>
  )
}
