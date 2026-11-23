import { spawn, type ChildProcess } from 'child_process'
import type { Rnnoise } from '@shiguredo/rnnoise-wasm'
import { DenoiseMixer } from './denoiseMix'

/**
 * On-device noise suppression for the microphone, run in the main process:
 *
 *   parec (mic, 48 kHz mono) -> RNNoise (WASM) -> gain -> pacat (virtual mic sink)
 *
 * parec/pacat ship in the same package as pactl (pulseaudio-utils), which the app already needs.
 * This deliberately avoids routing the mic through the renderer's Web Audio graph: measured on a
 * real PipeWire setup that path added ~300 ms of latency (Chromium's input-to-output buffering),
 * versus ~50 ms here. It also keeps working while the window is hidden to the tray.
 */

const SAMPLE_RATE = 48000
const LATENCY_MSEC = 10
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000

/**
 * Keeping latency from creeping up over a long call. The pipe has no rate matching of its own
 * (module-loopback does, inside PipeWire), so two things can make lag build up and never drain:
 *  - a stall of this process: parec keeps filling its pipe, then the whole backlog is processed
 *    and played late;
 *  - clock skew: the mic's clock and the (timer-driven) virtual sink's clock aren't locked, so if
 *    the mic runs faster, the surplus queues up in front of the sink.
 * Both mean the same thing: input arriving faster than real time. Live capture can never deliver
 * more audio than wall-clock time has elapsed, so any surplus is backlog. We keep a leaky bucket
 * of it - it only grows when input outruns real time, drains as time passes, and is clamped at
 * zero (so a burst can never leave a permanent offset behind). When it exceeds what normal chunk
 * jitter explains, the *oldest* queued audio is dropped and the newest kept.
 */
/** Backlog beyond the size of a normal chunk that is tolerated before dropping audio. */
const MAX_EXTRA_BACKLOG_MS = 40
const STATS_LOG_INTERVAL_MS = 5000

let rnnoisePromise: Promise<Rnnoise> | null = null

/** Loads the RNNoise WASM once, lazily (only when someone actually turns noise suppression on). */
function loadRnnoise(): Promise<Rnnoise> {
  if (!rnnoisePromise) {
    // Imported lazily so its ~5 MB of inlined WASM is only parsed when noise suppression is
    // actually used, not on every launch (including each --play= Stream Deck hand-off).
    //
    // The library's emscripten glue refuses to start unless it believes it's in a browser or a
    // worker. It's pure WASM with the module inlined, so nothing else browser-specific is used -
    // satisfy the check for the duration of the load, then put the global back.
    const g = globalThis as { WorkerGlobalScope?: unknown }
    const hadScope = 'WorkerGlobalScope' in g
    if (!hadScope) g.WorkerGlobalScope = class {}
    const loading = import('@shiguredo/rnnoise-wasm')
      .then(({ Rnnoise: RnnoiseImpl }) => RnnoiseImpl.load())
      .finally(() => {
        if (!hadScope) delete g.WorkerGlobalScope
      })
    // A failed load must be retryable, not cached forever.
    loading.catch(() => {
      rnnoisePromise = null
    })
    rnnoisePromise = loading
  }
  return rnnoisePromise
}

export interface DenoisePipe {
  /** Linear gain applied after denoising (the "Mic input level" setting), 1 = unity. */
  setGain: (gain: number) => void
  /** 0..1: how much of the denoised signal is mixed in (the rest is the untouched mic). */
  setStrength: (strength: number) => void
  stop: () => void
}

/**
 * Starts the pipeline. Resolves once the processes are spawned; `onExit` fires if either dies on
 * its own afterwards (mic unplugged, sink removed, ...) - not when `stop()` is called.
 */
export async function startDenoisePipe(
  sourceName: string,
  sinkName: string,
  initialGain: number,
  options: { light: boolean; strength: number },
  onExit: (reason: string) => void
): Promise<DenoisePipe> {
  const rnnoise = await loadRnnoise()
  const state = rnnoise.createDenoiseState()
  const frameSize = rnnoise.frameSize
  const frameBytes = frameSize * 2
  const frameMs = frameSize / (SAMPLE_RATE / 1000)

  const common = [`--format=s16le`, `--rate=${SAMPLE_RATE}`, '--channels=1', `--latency-msec=${LATENCY_MSEC}`, '--raw']
  const parec = spawn('parec', ['-d', sourceName, ...common, '--client-name=Noisitron', '--stream-name=Noisitron mic'], {
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const pacat = spawn(
    'pacat',
    ['-p', '-d', sinkName, ...common, '--client-name=Noisitron', '--stream-name=Noisitron denoised mic'],
    { stdio: ['pipe', 'ignore', 'ignore'] }
  )

  let gain = initialGain
  let strength = Math.min(1, Math.max(0, options.strength))
  const mixer = new DenoiseMixer(frameSize, options.light)
  let stopped = false
  let pending: Buffer = Buffer.alloc(0)
  const frame = new Float32Array(frameSize)

  // Backlog controller state (see the comment on MAX_EXTRA_BACKLOG_MS).
  let backlogMs = 0
  let lastEventAt: number | null = null
  let chunkMsEma = 0
  let droppedFrames = 0
  let lastLoggedDropped = 0
  let lastStatsLog = 0

  const shutdown = (): void => {
    stopped = true
    state.destroy()
    for (const p of [parec, pacat] as ChildProcess[]) {
      p.stdout?.removeAllListeners('data')
      if (!p.killed) p.kill()
    }
  }

  const died = (who: string) => (code: number | null): void => {
    if (stopped) return
    shutdown()
    onExit(`${who} exited (${code ?? 'signal'})`)
  }
  parec.on('exit', died('parec'))
  pacat.on('exit', died('pacat'))
  parec.on('error', () => died('parec')(null))
  pacat.on('error', () => died('pacat')(null))
  // A write after pacat has gone away raises EPIPE on its stdin; the 'exit' handler above deals
  // with the process dying, this just stops the error from becoming an uncaught exception.
  pacat.stdin?.on('error', () => {})

  parec.stdout?.on('data', (chunk: Buffer) => {
    if (stopped) return
    const now = performance.now()
    const chunkMs = chunk.length / BYTES_PER_MS
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk])

    // What counts as a "normal" chunk is learned (PipeWire's quantum varies), but a backlog burst
    // must not teach it that huge chunks are normal - cap how fast the estimate may grow.
    chunkMsEma =
      chunkMsEma === 0
        ? Math.min(Math.max(chunkMs, frameMs), 100)
        : chunkMsEma * 0.9 + Math.min(chunkMs, chunkMsEma * 2) * 0.1

    backlogMs = Math.max(0, backlogMs - (lastEventAt === null ? 0 : now - lastEventAt)) + chunkMs
    lastEventAt = now

    if (backlogMs > MAX_EXTRA_BACKLOG_MS + chunkMsEma * 1.5) {
      const drop = Math.min(
        Math.floor((backlogMs - chunkMsEma) / frameMs),
        Math.floor(pending.length / frameBytes)
      )
      if (drop > 0) {
        pending = pending.subarray(drop * frameBytes) // oldest audio goes, newest stays
        backlogMs -= drop * frameMs
        droppedFrames += drop
      }
    }

    while (pending.length >= frameBytes) {
      // RNNoise expects 16-bit-PCM-scaled samples (not -1..1), which is exactly what s16le gives.
      for (let i = 0; i < frameSize; i++) frame[i] = pending.readInt16LE(i * 2)
      pending = pending.subarray(frameBytes)
      const dry = frame.slice()
      const vad = state.processFrame(frame)
      mixer.mix(frame, dry, vad, strength)
      const out = Buffer.allocUnsafe(frameBytes)
      for (let i = 0; i < frameSize; i++) {
        out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(frame[i] * gain))), i * 2)
      }
      pacat.stdin?.write(out)
    }

    if (droppedFrames !== lastLoggedDropped && now - lastStatsLog > STATS_LOG_INTERVAL_MS) {
      lastStatsLog = now
      lastLoggedDropped = droppedFrames
      console.warn(`[noisitron] mic denoise: dropped ${droppedFrames} frames (${frameMs}ms each) of backlog so far`)
    }
  })

  return {
    setGain: (g) => {
      gain = Math.max(0, g)
    },
    setStrength: (s) => {
      strength = Math.min(1, Math.max(0, s))
    },
    stop: () => {
      if (!stopped) shutdown()
    }
  }
}
