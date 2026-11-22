import { useSoundboardStore } from '../store/soundboard'
import { folderPath } from '../utils/folders'
import { useFolderDropTarget } from '../utils/dnd'

/** One breadcrumb segment; also a drop target, so a sound can be dragged straight up to any
 *  ancestor folder (or root) without opening the sidebar. */
function Crumb({
  folderId,
  label,
  current
}: {
  folderId: string | null
  label: string
  current: boolean
}) {
  const selectFolder = useSoundboardStore((s) => s.selectFolder)
  const drop = useFolderDropTarget(folderId)

  return (
    <button
      {...drop.handlers}
      onClick={() => selectFolder(folderId)}
      className={`rounded px-1 transition-colors hover:text-slate-100 ${
        drop.over ? 'bg-accent-soft ring-1 ring-accent' : ''
      } ${current ? 'font-semibold text-slate-100' : 'text-slate-400'}`}
    >
      {label}
    </button>
  )
}

export function Breadcrumb() {
  const folders = useSoundboardStore((s) => s.folders)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)

  const path = folderPath(folders, selectedFolderId)

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-6 pt-4 text-sm">
      <Crumb folderId={null} label="🔊 All Sounds" current={selectedFolderId === null} />
      {path.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1.5">
          <span className="text-slate-600">/</span>
          <Crumb folderId={folder.id} label={folder.name} current={i === path.length - 1} />
        </span>
      ))}
    </div>
  )
}
