import type { Folder } from '@shared/types'

/** Ancestor chain from root to `folderId`, inclusive. Empty for root (null). */
export function folderPath(folders: Folder[], folderId: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: Folder[] = []
  let current = folderId ? byId.get(folderId) : undefined
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

/** Every folder as a flat, depth-first list with a "Parent / Child" display label - parents
 *  always precede their own children, so it reads sensibly in a plain <select>. */
export function folderOptions(folders: Folder[]): { id: string; label: string }[] {
  const byParent = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? []
    list.push(f)
    byParent.set(f.parentId, list)
  }

  const out: { id: string; label: string }[] = []
  function walk(parentId: string | null, prefix: string): void {
    const children = [...(byParent.get(parentId) ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    for (const f of children) {
      const label = prefix ? `${prefix} / ${f.name}` : f.name
      out.push({ id: f.id, label })
      walk(f.id, label)
    }
  }
  walk(null, '')
  return out
}
