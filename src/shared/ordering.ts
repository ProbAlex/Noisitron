import type { Sound } from './types'

/**
 * Moves one sound to a new folder and/or position. Library order is simply the order of the
 * persisted `sounds` array (each folder shows its own sounds in relative array order), so no
 * extra field is needed in the stored config - libraries from older versions keep working as-is.
 *
 * - `beforeId`: place the sound right before this sound; null/undefined appends it to the end.
 * - `folderId`: the folder the sound ends up in (null = root).
 *
 * Pure, so the renderer (optimistic update) and the main process (persisted update) apply the
 * exact same result.
 */
export function moveSoundInList(
  sounds: Sound[],
  id: string,
  folderId: string | null,
  beforeId: string | null
): Sound[] {
  const moving = sounds.find((s) => s.id === id)
  if (!moving) return sounds

  const rest = sounds.filter((s) => s.id !== id)
  const moved: Sound = { ...moving, folderId }

  const beforeIndex = beforeId && beforeId !== id ? rest.findIndex((s) => s.id === beforeId) : -1
  if (beforeIndex === -1) return [...rest, moved]
  return [...rest.slice(0, beforeIndex), moved, ...rest.slice(beforeIndex)]
}
