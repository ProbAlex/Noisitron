import { useSoundboardStore } from '../store/soundboard'
import { folderPath } from '../utils/folders'

export function Breadcrumb() {
  const folders = useSoundboardStore((s) => s.folders)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const selectFolder = useSoundboardStore((s) => s.selectFolder)

  const path = folderPath(folders, selectedFolderId)

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-6 pt-4 text-sm">
      <button
        onClick={() => selectFolder(null)}
        className={`transition-colors hover:text-slate-100 ${
          selectedFolderId === null ? 'font-semibold text-slate-100' : 'text-slate-400'
        }`}
      >
        🔊 All Sounds
      </button>
      {path.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1.5">
          <span className="text-slate-600">/</span>
          <button
            onClick={() => selectFolder(folder.id)}
            className={`transition-colors hover:text-slate-100 ${
              i === path.length - 1 ? 'font-semibold text-slate-100' : 'text-slate-400'
            }`}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </div>
  )
}
