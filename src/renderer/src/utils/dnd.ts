import { useState, type DragEvent } from 'react'
import { useSoundboardStore } from '../store/soundboard'

/** Drop target that moves the currently-dragged sound into `folderId` (null = root / All Sounds).
 *  Ignores drags that aren't a sound tile (e.g. files dragged in from the desktop). */
export function useFolderDropTarget(
  folderId: string | null,
  /** true for the grid itself: dropping on empty space within the same folder sends the sound
   *  to the end of it. Folder tiles / sidebar rows leave this off (same-folder drop = no-op). */
  appendWithinSameFolder = false
): {
  over: boolean
  handlers: {
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
} {
  const [over, setOver] = useState(false)

  return {
    over,
    handlers: {
      onDragOver: (e) => {
        if (!useSoundboardStore.getState().draggingSoundId) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave: (e) => {
        // Moving onto a child element fires dragleave on the parent - not a real exit.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOver(false)
      },
      onDrop: (e) => {
        setOver(false)
        const { draggingSoundId, moveSound, setDraggingSoundId, sounds } = useSoundboardStore.getState()
        if (!draggingSoundId) return
        e.preventDefault()
        e.stopPropagation()
        setDraggingSoundId(null)
        const dragged = sounds.find((s) => s.id === draggingSoundId)
        if (dragged && (appendWithinSameFolder || dragged.folderId !== folderId)) void moveSound(draggingSoundId, folderId, null)
      }
    }
  }
}
