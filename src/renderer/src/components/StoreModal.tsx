import { useEffect, useRef, useState } from 'react'
import type { StoreSearchResult } from '@shared/types'
import { useSoundboardStore } from '../store/soundboard'

interface StoreModalProps {
  onClose: () => void
}

const DEBOUNCE_MS = 400

export function StoreModal({ onClose }: StoreModalProps) {
  const downloadStoreSound = useSoundboardStore((s) => s.downloadStoreSound)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StoreSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadedPaths, setDownloadedPaths] = useState<Set<string>>(new Set())
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)
  const [previewingPath, setPreviewingPath] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlCacheRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      for (const url of previewUrlCacheRef.current.values()) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const requestId = ++requestIdRef.current
    const timer = setTimeout(() => {
      window.api.store
        .search(query)
        .then((found) => {
          if (requestIdRef.current !== requestId) return
          setResults(found)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (requestIdRef.current !== requestId) return
          setError(err instanceof Error ? err.message : 'Search failed.')
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function togglePreview(result: StoreSearchResult): Promise<void> {
    if (previewingPath === result.mp3Path) {
      previewAudioRef.current?.pause()
      setPreviewingPath(null)
      return
    }
    previewAudioRef.current?.pause()
    try {
      let url = previewUrlCacheRef.current.get(result.mp3Path)
      if (!url) {
        const bytes = await window.api.store.preview(result.mp3Path)
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        const blob = new Blob([buffer], { type: 'audio/mpeg' })
        url = URL.createObjectURL(blob)
        previewUrlCacheRef.current.set(result.mp3Path, url)
      }
      // Plain default-output playback, same as TrimEditor's preview - a quick proof-listen,
      // not routed through the mic/headphone bus like an actual soundboard trigger.
      const audioEl = new Audio(url)
      previewAudioRef.current = audioEl
      audioEl.addEventListener('ended', () => setPreviewingPath(null))
      setPreviewingPath(result.mp3Path)
      await audioEl.play()
    } catch {
      setPreviewingPath(null)
      setError("Couldn't preview that sound.")
    }
  }

  async function handleDownload(result: StoreSearchResult): Promise<void> {
    setDownloadingPath(result.mp3Path)
    setError(null)
    try {
      await downloadStoreSound(result)
      setDownloadedPaths((prev) => new Set(prev).add(result.mp3Path))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloadingPath(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(640px,85vh)] w-full max-w-xl flex-col gap-4 rounded-2xl border border-base-700 bg-base-850 p-6 shadow-2xl shadow-black/50 animate-pop-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Sound Store</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search myinstants.com…"
          className="w-full rounded-lg border border-base-600 bg-base-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="py-6 text-center text-sm text-slate-500">Searching…</p>}

          {!loading && query.trim() && results.length === 0 && !error && (
            <p className="py-6 text-center text-sm text-slate-500">No sounds found for "{query}".</p>
          )}

          {!loading && !query.trim() && (
            <p className="py-6 text-center text-sm text-slate-500">
              Search for a sound to add.
            </p>
          )}

          <ul className="flex flex-col gap-1">
            {results.map((result) => {
              const downloaded = downloadedPaths.has(result.mp3Path)
              const downloading = downloadingPath === result.mp3Path
              const previewing = previewingPath === result.mp3Path
              return (
                <li
                  key={result.mp3Path}
                  className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2"
                >
                  <button
                    onClick={() => void togglePreview(result)}
                    title={previewing ? 'Stop preview' : 'Preview'}
                    className="shrink-0 rounded-md border border-base-600 px-2 py-1 text-xs text-slate-300 hover:border-base-500 hover:text-slate-100"
                  >
                    {previewing ? '■' : '▶'}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{result.title}</span>
                  <button
                    onClick={() => void handleDownload(result)}
                    disabled={downloading || downloaded}
                    className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloaded ? 'Added ✓' : downloading ? 'Adding…' : '+ Add'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
