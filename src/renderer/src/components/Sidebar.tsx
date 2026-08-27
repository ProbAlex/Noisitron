import { useState } from 'react'
import type { Folder } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'

function FolderRow({ folder, count }: { folder: Folder; count: number }) {
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const renameFolder = useSoundboardStore((s) => s.renameFolder)
  const removeFolder = useSoundboardStore((s) => s.removeFolder)
  const syncFolder = useSoundboardStore((s) => s.syncFolder)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(folder.name)
  const [syncing, setSyncing] = useState(false)
  const selected = selectedFolderId === folder.id

  function commit(): void {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== folder.name) void renameFolder(folder.id, trimmed)
    else setDraft(folder.name)
  }

  return (
    <div
      onClick={() => !editing && selectFolder(folder.id)}
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        selected ? 'bg-accent-soft text-slate-100' : 'text-slate-400 hover:bg-base-800 hover:text-slate-200'
      }`}
    >
      <span className="text-sm">📁</span>
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
          className="min-w-0 flex-1 rounded bg-base-950 px-1 py-0.5 text-sm text-slate-100 outline-none ring-1 ring-accent"
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          className="min-w-0 flex-1 truncate"
          title="Double-click to rename"
        >
          {folder.name}
        </span>
      )}
      <span className="text-xs tabular-nums text-slate-500">{count}</span>
      {folder.sourcePath && (
        <button
          onClick={async (e) => {
            e.stopPropagation()
            setSyncing(true)
            await syncFolder(folder.id)
            setSyncing(false)
          }}
          disabled={syncing}
          title="Sync: pull in files added to the source folder since it was imported"
          className={`hidden h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-500 hover:bg-base-700 hover:text-slate-200 group-hover:flex ${syncing ? 'flex animate-spin' : ''}`}
        >
          ⟳
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          void removeFolder(folder.id)
        }}
        title="Remove folder (keeps its sounds)"
        className="hidden h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-500 hover:bg-red-500/80 hover:text-white group-hover:flex"
      >
        ×
      </button>
    </div>
  )
}

export function Sidebar() {
  const sounds = useSoundboardStore((s) => s.sounds)
  const folders = useSoundboardStore((s) => s.folders)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const importFolder = useSoundboardStore((s) => s.importFolder)

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-base-700 bg-base-925 p-3">
      <button
        onClick={() => selectFolder(null)}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
          selectedFolderId === null
            ? 'bg-accent-soft text-slate-100'
            : 'text-slate-400 hover:bg-base-800 hover:text-slate-200'
        }`}
      >
        <span className="text-sm">🔊</span>
        <span className="flex-1 text-left">All Sounds</span>
        <span className="text-xs tabular-nums text-slate-500">{sounds.length}</span>
      </button>

      <div className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            count={sounds.filter((s) => s.folderId === folder.id).length}
          />
        ))}
      </div>

      <button
        onClick={() => void importFolder()}
        className="mt-2 rounded-lg border border-dashed border-base-600 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-accent hover:text-accent"
      >
        ＋ Import folder
      </button>
    </aside>
  )
}
