const cache = new Map<string, string>()

/** Loads a custom sound-icon image through the sandboxed IPC read and hands back a
 *  blob: URL (the CSP allows blob: for img-src, not file:). Results are cached per
 *  path — pickImage/clearIcon always write a fresh path, so nothing here goes stale. */
export async function getIconObjectUrl(filePath: string): Promise<string> {
  const cached = cache.get(filePath)
  if (cached) return cached
  const bytes = await window.api.sounds.readIcon(filePath)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  cache.set(filePath, url)
  return url
}
