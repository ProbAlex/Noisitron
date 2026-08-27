import { useEffect, useRef, useState } from 'react'
import { useSoundboardStore } from '../store/soundboard'
import { encodeWav } from '../utils/wav'

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 140
const MIN_SELECTION_SECONDS = 0.05

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2)
  return `${m}:${s.padStart(5, '0')}`
}

function drawWaveform(canvas: HTMLCanvasElement, data: Float32Array): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = CANVAS_WIDTH * dpr
  canvas.height = CANVAS_HEIGHT * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const mid = CANVAS_HEIGHT / 2
  const samplesPerPixel = Math.max(1, Math.floor(data.length / CANVAS_WIDTH))
  ctx.strokeStyle = '#a78bfa'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    const start = x * samplesPerPixel
    const end = Math.min(data.length, start + samplesPerPixel)
    let min = 0
    let max = 0
    for (let i = start; i < end; i++) {
      const v = data[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    ctx.moveTo(x + 0.5, mid - max * mid)
    ctx.lineTo(x + 0.5, mid - min * mid)
  }
  ctx.stroke()
}

export function TrimEditor() {
  const trimSoundId = useSoundboardStore((s) => s.trimSoundId)
  const sound = useSoundboardStore((s) => s.sounds.find((x) => x.id === trimSoundId))
  const closeTrimEditor = useSoundboardStore((s) => s.closeTrimEditor)
  const saveTrim = useSoundboardStore((s) => s.saveTrim)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const dragRef = useRef<'start' | 'end' | null>(null)

  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [startRatio, setStartRatio] = useState(0)
  const [endRatio, setEndRatio] = useState(1)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setBuffer(null)
    setLoadError(null)
    setStartRatio(0)
    setEndRatio(1)
    if (!sound) return

    let cancelled = false
    void (async () => {
      try {
        const bytes = await window.api.sounds.readFile(sound.filePath)
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        const ctx = audioCtxRef.current ?? new AudioContext()
        audioCtxRef.current = ctx
        const decoded = await ctx.decodeAudioData(arrayBuffer)
        if (!cancelled) setBuffer(decoded)
      } catch {
        if (!cancelled) setLoadError("Couldn't decode this audio file for trimming.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sound?.id])

  useEffect(() => {
    if (buffer && canvasRef.current) drawWaveform(canvasRef.current, buffer.getChannelData(0))
  }, [buffer])

  useEffect(() => {
    if (!trimSoundId) return
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeTrimEditor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [trimSoundId, closeTrimEditor])

  useEffect(() => {
    return () => {
      previewSourceRef.current?.stop()
      void audioCtxRef.current?.close()
    }
  }, [])

  // Refs mirroring latest ratios so the drag handlers (captured once per pointerdown)
  // always clamp against the other handle's *current* position, not a stale closure.
  const startRatioRef = useRef(startRatio)
  const endRatioRef = useRef(endRatio)
  startRatioRef.current = startRatio
  endRatioRef.current = endRatio

  if (!trimSoundId || !sound) return null

  function ratioFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  function startDrag(which: 'start' | 'end'): void {
    dragRef.current = which
    function onMove(e: PointerEvent): void {
      const ratio = ratioFromClientX(e.clientX)
      const minGap = buffer ? MIN_SELECTION_SECONDS / buffer.duration : 0.01
      if (dragRef.current === 'start') {
        setStartRatio(Math.min(ratio, endRatioRef.current - minGap))
      } else if (dragRef.current === 'end') {
        setEndRatio(Math.max(ratio, startRatioRef.current + minGap))
      }
    }
    function onUp(): void {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function stopPreview(): void {
    previewSourceRef.current?.stop()
    previewSourceRef.current = null
    setPreviewing(false)
  }

  function togglePreview(): void {
    if (!buffer) return
    if (previewing) {
      stopPreview()
      return
    }
    const ctx = audioCtxRef.current
    if (!ctx) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    const start = startRatio * buffer.duration
    const duration = Math.max(0.01, endRatio * buffer.duration - start)
    source.onended = () => {
      previewSourceRef.current = null
      setPreviewing(false)
    }
    source.start(0, start, duration)
    previewSourceRef.current = source
    setPreviewing(true)
  }

  async function handleSave(): Promise<void> {
    if (!buffer || !sound) return
    stopPreview()
    setSaving(true)
    try {
      const startSample = Math.floor(startRatio * buffer.length)
      const endSample = Math.max(startSample + 1, Math.floor(endRatio * buffer.length))
      const channels: Float32Array[] = []
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        channels.push(buffer.getChannelData(ch).slice(startSample, endSample))
      }
      const bytes = encodeWav(channels, buffer.sampleRate)
      await saveTrim(sound.id, bytes)
    } finally {
      setSaving(false)
    }
  }

  const duration = buffer?.duration ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 animate-fade-in" onClick={closeTrimEditor}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-base-700 bg-base-850 p-6 shadow-2xl shadow-black/50 animate-pop-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Trim "{sound.name}"</h2>
          <button onClick={closeTrimEditor} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {loadError && <p className="text-sm text-red-400">{loadError}</p>}

        {!buffer && !loadError && (
          <div className="flex h-[140px] items-center justify-center text-sm text-slate-500">Loading…</div>
        )}

        {buffer && (
          <>
            <div
              ref={trackRef}
              className="relative select-none overflow-hidden rounded-lg bg-base-950"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
              <canvas ref={canvasRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} />
              <div
                className="absolute inset-y-0 left-0 bg-black/60"
                style={{ width: `${startRatio * 100}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-black/60"
                style={{ width: `${(1 - endRatio) * 100}%` }}
              />
              <div
                onPointerDown={(e) => {
                  e.preventDefault()
                  startDrag('start')
                }}
                title="Drag to set start"
                className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize bg-accent"
                style={{ left: `${startRatio * 100}%` }}
              />
              <div
                onPointerDown={(e) => {
                  e.preventDefault()
                  startDrag('end')
                }}
                title="Drag to set end"
                className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize bg-accent"
                style={{ left: `${endRatio * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs tabular-nums text-slate-400">
              <span>{formatTime(startRatio * duration)}</span>
              <span className="text-slate-500">
                selection: {formatTime(Math.max(0, endRatio - startRatio) * duration)}
              </span>
              <span>{formatTime(endRatio * duration)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-base-700 pt-4">
              <button
                onClick={togglePreview}
                className="rounded-lg border border-base-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-base-500 hover:text-slate-100"
              >
                {previewing ? '■ Stop' : '▶ Preview selection'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeTrimEditor}
                  className="rounded-lg border border-base-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-base-500 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save trim'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
