import { useEffect, useState } from 'react'
import type { Folder } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'

const COLLAPSED_KEY = 'noisitron.sidebarCollapsed'

function FolderTreeNode({ folder, depth }: { folder: Folder; depth: number }) {
  const allFolders = useSoundboardStore((s) => s.folders)
  const sounds = useSoundboardStore((s) => s.sounds)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const renameFolder = useSoundboardStore((s) => s.renameFolder)
  const removeFolder = useSoundboardStore((s) => s.removeFolder)
  const syncFolder = useSoundboardStore((s) => s.syncFolder)

  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(folder.name)
  const [syncing, setSyncing] = useState(false)

  const children = allFolders.filter((f) => f.parentId === folder.id)
  const selected = selectedFolderId === folder.id
  const count = children.length + sounds.filter((s) => s.folderId === folder.id).length

  function commit(): void {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== folder.name) void renameFolder(folder.id, trimmed)
    else setDraft(folder.name)
  }

  return (
    <div>
      <div
        onClick={() => !editing && selectFolder(folder.id)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={`group flex items-center gap-1 rounded-lg py-1 pr-2 text-sm transition-colors ${
          selected ? 'bg-accent-soft text-slate-100' : 'text-slate-400 hover:bg-base-800 hover:text-slate-200'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-slate-500 ${
            children.length === 0 ? 'invisible' : ''
          }`}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span className="shrink-0 text-sm">📁</span>
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
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{count}</span>
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
            className={`hidden h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-500 hover:bg-base-700 hover:text-slate-200 group-hover:flex ${
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
          className="hidden h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-500 hover:bg-red-500/80 hover:text-white group-hover:flex"
        >
          ×
        </button>
      </div>
      {expanded &&
        children.map((child) => <FolderTreeNode key={child.id} folder={child} depth={depth + 1} />)}
    </div>
  )
}

export function Sidebar() {
  const sounds = useSoundboardStore((s) => s.sounds)
  const folders = useSoundboardStore((s) => s.folders)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const importFolder = useSoundboardStore((s) => s.importFolder)
  const createFolder = useSoundboardStore((s) => s.createFolder)

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      // Private/blocked storage - fine, just won't remember across restarts.
    }
  }, [collapsed])

  const rootFolders = folders.filter((f) => f.parentId === null)

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-base-700 bg-base-925 py-3">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-base-800 hover:text-slate-200"
        >
          »
        </button>
        <button
          onClick={() => selectFolder(null)}
          title="All Sounds"
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
            selectedFolderId === null ? 'bg-accent-soft text-slate-100' : 'text-slate-400 hover:bg-base-800'
          }`}
        >
          🔊
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-base-700 bg-base-925 p-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Library</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => void createFolder('New folder')}
            title="New folder here"
            className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-slate-500 hover:bg-base-800 hover:text-slate-200"
          >
            ＋
          </button>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-slate-500 hover:bg-base-800 hover:text-slate-200"
          >
            «
          </button>
        </div>
      </div>

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

      <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {rootFolders.map((folder) => (
          <FolderTreeNode key={folder.id} folder={folder} depth={0} />
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
