import { useState } from 'react'
import type { Folder } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'

interface FolderTileProps {
  folder: Folder
  itemCount: number
}

export function FolderTile({ folder, itemCount }: FolderTileProps) {
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const renameFolder = useSoundboardStore((s) => s.renameFolder)
  const removeFolder = useSoundboardStore((s) => s.removeFolder)
  const syncFolder = useSoundboardStore((s) => s.syncFolder)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(folder.name)
  const [syncing, setSyncing] = useState(false)

  function commit(): void {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== folder.name) void renameFolder(folder.id, trimmed)
    else setDraft(folder.name)
  }

  return (
    <div
      onClick={() => !editing && selectFolder(folder.id)}
      className="group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-base-700 bg-base-850 p-4 pt-5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-base-600 hover:bg-base-800 hover:shadow-lg hover:shadow-black/20"
    >
      {folder.sourcePath && (
        <button
          onClick={async (e) => {
            e.stopPropagation()
            setSyncing(true)
            await syncFolder(folder.id)
            setSyncing(false)
          }}
          disabled={syncing}
          title="Sync from source folder"
          className={`absolute left-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-base-700 text-xs text-slate-300 hover:bg-base-600 group-hover:flex ${
            syncing ? 'flex animate-spin' : ''
          }`}
        >
          ⟳
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          void removeFolder(folder.id)
        }}
        title="Remove folder (keeps its contents)"
        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-base-700 text-xs text-slate-300 hover:bg-red-500/80 hover:text-white group-hover:flex"
      >
        ×
      </button>

      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-base-700/70 text-3xl">📁</div>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(folder.name)
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
          {folder.name}
        </span>
      )}
      <span className="text-xs tabular-nums text-slate-500">
        {itemCount} item{itemCount === 1 ? '' : 's'}
      </span>
    </div>
  )
}
