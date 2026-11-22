import { useEffect, useState, type DragEvent } from 'react'
import type { Sound } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'
import { getIconObjectUrl } from '../utils/iconUrl'
import { formatAccelerator } from '../utils/accelerator'

interface SoundTileProps {
  sound: Sound
  playing: boolean
  /** id of the sound right after this one in the current folder, or null if this is the last -
   *  needed to turn "dropped on my right half" into an insert position. */
  nextSoundId: string | null
}

export function SoundTile({ sound, playing, nextSoundId }: SoundTileProps) {
  const playSound = useSoundboardStore((s) => s.playSound)
  const stopSound = useSoundboardStore((s) => s.stopSound)
  const renameSound = useSoundboardStore((s) => s.renameSound)
  const openSoundMenu = useSoundboardStore((s) => s.openSoundMenu)
  const moveSound = useSoundboardStore((s) => s.moveSound)
  const setDraggingSoundId = useSoundboardStore((s) => s.setDraggingSoundId)
  const isDragging = useSoundboardStore((s) => s.draggingSoundId === sound.id)

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(sound.name)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  /** Which side of this tile a dragged sound would land on, while one is hovering over it. */
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null)

  useEffect(() => {
    let cancelled = false
    if (sound.imagePath) {
      void getIconObjectUrl(sound.imagePath).then((url) => {
        if (!cancelled) setImageUrl(url)
      })
    } else {
      setImageUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [sound.imagePath])

  function toggle(): void {
    if (playing) stopSound(sound.id)
    else void playSound(sound)
  }

  function sideOf(e: DragEvent): 'before' | 'after' {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  function onDragOver(e: DragEvent): void {
    const dragging = useSoundboardStore.getState().draggingSoundId
    if (!dragging) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropSide(dragging === sound.id ? null : sideOf(e))
  }

  function onDrop(e: DragEvent): void {
    const dragging = useSoundboardStore.getState().draggingSoundId
    const side = sideOf(e)
    setDropSide(null)
    if (!dragging) return
    e.preventDefault()
    e.stopPropagation()
    setDraggingSoundId(null)
    if (dragging === sound.id) return
    const beforeId = side === 'before' ? sound.id : nextSoundId
    // Dropping right where it already sits (e.g. "after" the tile just before it) is a no-op.
    if (beforeId === dragging) return
    void moveSound(dragging, sound.folderId, beforeId)
  }

  function commitRename(): void {
    setEditing(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== sound.name) renameSound(sound.id, trimmed)
    else setDraftName(sound.name)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', sound.name)
        setDraggingSoundId(sound.id)
      }}
      onDragEnd={() => {
        setDraggingSoundId(null)
        setDropSide(null)
      }}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropSide(null)
      }}
      onDrop={onDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        openSoundMenu(sound.id, e.clientX, e.clientY)
      }}
      className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 pt-5 text-center transition-all duration-150 ${
        isDragging ? 'opacity-40' : ''
      } ${
        playing
          ? 'border-accent bg-accent-soft/50 shadow-[0_0_0_1px_theme(colors.accent.DEFAULT),0_10px_28px_-10px_theme(colors.accent.DEFAULT)]'
          : 'border-base-700 bg-base-850 hover:-translate-y-0.5 hover:border-base-600 hover:bg-base-800 hover:shadow-lg hover:shadow-black/20'
      }`}
    >
      {dropSide && (
        <span
          className={`pointer-events-none absolute -bottom-1 -top-1 w-1 rounded-full bg-accent ${
            dropSide === 'before' ? '-left-2' : '-right-2'
          }`}
        />
      )}

      {sound.keybind && (
        <span
          title={`Shortcut: ${formatAccelerator(sound.keybind)}`}
          className="absolute left-2 top-2 rounded-md border border-base-600 bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400"
        >
          {formatAccelerator(sound.keybind)}
        </span>
      )}

      <button
        onClick={toggle}
        title="Click to play/stop · Right-click for options"
        className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-3xl transition-transform active:scale-95 ${
          playing ? 'scale-105 bg-accent/20' : 'bg-base-700/70'
        }`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{sound.emoji ?? '🎵'}</span>
        )}
        <span
          className={`absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] shadow ${
            playing ? 'bg-accent text-white' : 'bg-base-950/80 text-slate-300'
          }`}
        >
          {playing ? '■' : '▶'}
        </span>
      </button>

      {editing ? (
        <input
          autoFocus
          value={draftName}
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
          onDoubleClick={() => setEditing(true)}
          className="line-clamp-2 w-full text-sm font-medium text-slate-200"
          title="Double-click to rename · Right-click to edit"
        >
          {sound.name}
        </span>
      )}
    </div>
  )
}
