import { useSoundboardStore } from '../store/soundboard'
import { SoundTile } from './SoundTile'
import { FolderTile } from './FolderTile'
import { useFolderDropTarget } from '../utils/dnd'

export function SoundGrid() {
  const sounds = useSoundboardStore((s) => s.sounds)
  const folders = useSoundboardStore((s) => s.folders)
  const selectedFolderId = useSoundboardStore((s) => s.selectedFolderId)
  const activeSoundIds = useSoundboardStore((s) => s.activeSoundIds)
  const importSounds = useSoundboardStore((s) => s.importSounds)

  // Dropping on the grid's empty space sends the sound to the end of the folder being viewed.
  const gridDrop = useFolderDropTarget(selectedFolderId, true)

  const subfolders = folders.filter((f) => f.parentId === selectedFolderId)
  const directSounds = sounds.filter((s) => s.folderId === selectedFolderId)

  if (sounds.length === 0 && folders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500">
        <div className="text-4xl">🔇</div>
        <p className="text-sm">No sounds yet. Import some .wav, .mp3, or .ogg clips to get started.</p>
        <button
          onClick={() => void importSounds()}
          className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Import sounds
        </button>
      </div>
    )
  }

  if (subfolders.length === 0 && directSounds.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500">
        <div className="text-4xl">📁</div>
        <p className="text-sm">This folder is empty.</p>
        <div className="flex gap-2">
          <button
            onClick={() => void importSounds()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Import sounds
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      {...gridDrop.handlers}
      className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3"
    >
      {subfolders.map((folder) => (
        <FolderTile
          key={folder.id}
          folder={folder}
          itemCount={
            folders.filter((f) => f.parentId === folder.id).length +
            sounds.filter((s) => s.folderId === folder.id).length
          }
        />
      ))}
      {directSounds.map((sound, i) => (
        <SoundTile
          key={sound.id}
          sound={sound}
          playing={activeSoundIds.has(sound.id)}
          nextSoundId={directSounds[i + 1]?.id ?? null}
        />
      ))}
      <button
        onClick={() => void importSounds()}
        className="flex min-h-[152px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-base-600 text-slate-500 hover:border-accent hover:text-accent"
      >
        <span className="text-2xl">＋</span>
        <span className="text-xs font-medium">Import sound</span>
      </button>
    </div>
  )
}
