import { useState } from 'react'
import type { Sound } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'
import { VolumeSlider } from './VolumeSlider'

interface SoundTileProps {
  sound: Sound
  playing: boolean
}

export function SoundTile({ sound, playing }: SoundTileProps) {
  const playSound = useSoundboardStore((s) => s.playSound)
  const stopSound = useSoundboardStore((s) => s.stopSound)
  const setSoundVolume = useSoundboardStore((s) => s.setSoundVolume)
  const removeSound = useSoundboardStore((s) => s.removeSound)
  const renameSound = useSoundboardStore((s) => s.renameSound)

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(sound.name)

  function toggle(): void {
    if (playing) stopSound(sound.id)
    else void playSound(sound)
  }

  function commitRename(): void {
    setEditing(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== sound.name) renameSound(sound.id, trimmed)
    else setDraftName(sound.name)
  }

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
        playing
          ? 'border-accent bg-accent-soft/60 shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]'
          : 'border-base-700 bg-base-850 hover:border-base-600 hover:bg-base-800'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          void removeSound(sound.id)
        }}
        title="Remove sound"
        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-base-700 text-xs text-slate-300 hover:bg-red-500/80 hover:text-white group-hover:flex"
      >
        ×
      </button>

      <button onClick={toggle} className="flex flex-col items-center gap-2 pt-1 text-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg ${
            playing ? 'bg-accent text-white' : 'bg-base-700 text-slate-200'
          }`}
        >
          {playing ? '■' : '▶'}
        </div>
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraftName(sound.name)
                setEditing(false)
              }
            }}
            className="w-full rounded bg-base-950 px-1.5 py-0.5 text-center text-sm text-slate-100 outline-none ring-1 ring-accent"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className="line-clamp-2 w-full text-sm font-medium text-slate-200"
            title="Double-click to rename"
          >
            {sound.name}
          </span>
        )}
      </button>

      <div onClick={(e) => e.stopPropagation()}>
        <VolumeSlider
          compact
          value={sound.volume}
          onChange={(v) => setSoundVolume(sound.id, v)}
        />
      </div>
    </div>
  )
}
