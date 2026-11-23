import { execFile, spawn, type ChildProcess } from 'child_process'
import {
  DEFAULT_NOISE_SUPPRESSION_STRENGTH,
  VIRTUAL_MIC_SINK_DESCRIPTION,
  type AudioDevice,
  type NoiseSuppressionMode,
  type VirtualMicStatus
} from '../shared/types'
import { startDenoisePipe, type DenoisePipe } from './denoise'

/**
 * All routing goes through pactl. On PipeWire systems this talks to the
 * pipewire-pulse compatibility layer; on classic PulseAudio systems it talks
 * to the real pulse daemon. Either way the same commands work, which is what
 * lets this run unmodified regardless of which sound server owns the box.
 */

export const VIRTUAL_SINK_NAME = 'noisitron_mic'
export const VIRTUAL_MONITOR_NAME = `${VIRTUAL_SINK_NAME}.monitor`
export const VIRTUAL_SOURCE_NAME = `${VIRTUAL_SINK_NAME}.mic`

function pactl(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('pactl', args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`pactl ${args.join(' ')} failed: ${stderr || error.message}`))
        return
      }
      resolvePromise(stdout.trim())
    })
  })
}

async function pactlJson<T>(args: string[]): Promise<T> {
  const out = await pactl(['-f', 'json', ...args])
  return out ? (JSON.parse(out) as T) : ([] as unknown as T)
}

interface PactlSourceOrSink {
  index: number
  name: string
  /** pactl genuinely emits JSON null here for some devices, despite always having a name. */
  description: string | null
}

interface PactlSinkInput {
  index: number
  owner_module: string | null
}

interface ShortModuleRow {
  index: string
  name: string
  argument: string
}

async function listModulesShort(): Promise<ShortModuleRow[]> {
  const out = await pactl(['list', 'modules', 'short'])
  if (!out) return []
  return out
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((cols) => cols.length >= 3)
    .map(([index, name, argument]) => ({ index, name, argument }))
}

async function findSinkInputIndexForModule(moduleId: string): Promise<number | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const inputs = await pactlJson<PactlSinkInput[]>(['list', 'sink-inputs'])
    const match = inputs.find((i) => i.owner_module === moduleId)
    if (match) return match.index
    await new Promise((r) => setTimeout(r, 50))
  }
  return null
}

/** pactl's JSON output types `description` as a string, but some sources/sinks
 *  (ones lacking a device.description/node.description property - seen on some
 *  generic or synthetic devices) genuinely emit `null` there. Fall back to the
 *  internal name rather than handing the renderer a blank, unusable label. */
function describeDevice(d: PactlSourceOrSink): AudioDevice {
  return { name: d.name, description: d.description || d.name, index: d.index }
}

export async function listSources(): Promise<AudioDevice[]> {
  const sources = await pactlJson<PactlSourceOrSink[]>(['list', 'sources'])
  return sources
    .filter((s) => !s.name.endsWith('.monitor') && s.name !== VIRTUAL_SOURCE_NAME)
    .map(describeDevice)
}

export async function listSinks(): Promise<AudioDevice[]> {
  const sinks = await pactlJson<PactlSourceOrSink[]>(['list', 'sinks'])
  return sinks
    .filter((s) => s.name !== VIRTUAL_SINK_NAME)
    .map(describeDevice)
}

/** Removes any leftover soundboard modules from a previous run that crashed / was killed. */
export async function cleanupStaleModules(): Promise<void> {
  const modules = await listModulesShort()
  const staleSources = modules.filter(
    (m) => m.name === 'module-remap-source' && m.argument.includes(`source_name=${VIRTUAL_SOURCE_NAME}`)
  )
  const staleLoopbacks = modules.filter(
    (m) => m.name === 'module-loopback' && m.argument.includes(`sink=${VIRTUAL_SINK_NAME}`)
  )
  const staleSinks = modules.filter(
    (m) => m.name === 'module-null-sink' && m.argument.includes(`sink_name=${VIRTUAL_SINK_NAME}`)
  )
  for (const m of staleSources) {
    await pactl(['unload-module', m.index]).catch(() => {})
  }
  for (const m of staleLoopbacks) {
    await pactl(['unload-module', m.index]).catch(() => {})
  }
  for (const m of staleSinks) {
    await pactl(['unload-module', m.index]).catch(() => {})
  }
}

interface InternalState {
  sinkModuleId: string | null
  sourceModuleId: string | null
  loopbackModuleId: string | null
  loopbackSinkInputIndex: number | null
  /** source the loopback is currently reading from (null = no loopback loaded) */
  micSourceName: string | null
  /** the user's explicit pick; null = follow the system default input */
  selectedMicSource: string | null
  /** the system default input, if usable as a mic (see isUsableMicSource) */
  defaultSourceName: string | null
  noiseSuppression: NoiseSuppressionMode
  /** 0-100, the noise suppression strength slider */
  noiseSuppressionStrength: number
  micLoopbackVolumePercent: number
  /** the running on-device denoise pipeline, if any (replaces the loopback while it runs) */
  denoise: { sourceName: string; light: boolean; pipe: DenoisePipe } | null
  noiseSuppressionError: string | null
}

const state: InternalState = {
  sinkModuleId: null,
  sourceModuleId: null,
  loopbackModuleId: null,
  loopbackSinkInputIndex: null,
  micSourceName: null,
  selectedMicSource: null,
  defaultSourceName: null,
  noiseSuppression: 'none',
  noiseSuppressionStrength: DEFAULT_NOISE_SUPPRESSION_STRENGTH,
  micLoopbackVolumePercent: 100,
  denoise: null,
  noiseSuppressionError: null
}

/** Never loop our own virtual mic (or any monitor source) back into itself - that's a feedback
 *  loop, and can happen if the user has made Noisitron's mic their system default input. */
function isUsableMicSource(name: string): boolean {
  return name !== VIRTUAL_SOURCE_NAME && !name.endsWith('.monitor')
}

/** The system's current default input, or null if there is none / it isn't usable as a mic. */
async function resolveDefaultSource(): Promise<string | null> {
  try {
    const name = await pactl(['get-default-source'])
    return name && isUsableMicSource(name) ? name : null
  } catch {
    return null
  }
}

async function loadVirtualSource(): Promise<void> {
  const id = await pactl([
    'load-module',
    'module-remap-source',
    `master=${VIRTUAL_MONITOR_NAME}`,
    `source_name=${VIRTUAL_SOURCE_NAME}`,
    `source_properties=device.description=${VIRTUAL_MIC_SINK_DESCRIPTION}`
  ])
  state.sourceModuleId = id
}

async function loadLoopback(sourceName: string): Promise<void> {
  const id = await pactl([
    'load-module',
    'module-loopback',
    `source=${sourceName}`,
    `sink=${VIRTUAL_SINK_NAME}`,
    'latency_msec=1'
  ])
  state.loopbackModuleId = id
  state.micSourceName = sourceName
  state.loopbackSinkInputIndex = await findSinkInputIndexForModule(id)
  if (state.loopbackSinkInputIndex !== null) {
    await pactl([
      'set-sink-input-volume',
      String(state.loopbackSinkInputIndex),
      `${state.micLoopbackVolumePercent}%`
    ])
  }
}

async function unloadLoopback(): Promise<void> {
  if (state.loopbackModuleId) {
    await pactl(['unload-module', state.loopbackModuleId]).catch(() => {})
  }
  state.loopbackModuleId = null
  state.loopbackSinkInputIndex = null
  state.micSourceName = null
}

async function unloadVirtualSource(): Promise<void> {
  if (state.sourceModuleId) {
    await pactl(['unload-module', state.sourceModuleId]).catch(() => {})
  }
  state.sourceModuleId = null
}

export function getStatus(): VirtualMicStatus {
  return {
    active: state.sinkModuleId !== null,
    sinkName: VIRTUAL_SINK_NAME,
    monitorSourceName: VIRTUAL_SOURCE_NAME,
    micSourceName: state.denoise?.sourceName ?? state.micSourceName,
    micLoopbackVolumePercent: state.micLoopbackVolumePercent,
    defaultSourceName: state.defaultSourceName,
    noiseSuppressionActive: state.denoise !== null,
    noiseSuppressionError: state.noiseSuppressionError
  }
}

export async function createVirtualMic(
  micSourceName: string | null,
  noiseSuppression: NoiseSuppressionMode,
  noiseSuppressionStrength: number
): Promise<VirtualMicStatus> {
  if (state.sinkModuleId === null) {
    await cleanupStaleModules()
    state.sinkModuleId = await pactl([
      'load-module',
      'module-null-sink',
      `sink_name=${VIRTUAL_SINK_NAME}`,
      `sink_properties=device.description=${VIRTUAL_MIC_SINK_DESCRIPTION}`
    ])
  }
  if (state.sourceModuleId === null) {
    await loadVirtualSource()
  }
  state.selectedMicSource = micSourceName
  state.noiseSuppression = noiseSuppression
  state.noiseSuppressionStrength = noiseSuppressionStrength
  await applyMicRouting()
  return getStatus()
}

export async function destroyVirtualMic(): Promise<void> {
  stopDenoise()
  await unloadLoopback()
  await unloadVirtualSource()
  if (state.sinkModuleId) {
    await pactl(['unload-module', state.sinkModuleId]).catch(() => {})
  }
  state.sinkModuleId = null
}

function stopDenoise(): void {
  state.denoise?.pipe.stop()
  state.denoise = null
}

let routingQueue: Promise<void> = Promise.resolve()
let denoiseRetries: number[] = []
let onRoutingChanged: ((status: VirtualMicStatus) => void) | null = null

/** Makes the mic path match the current settings, picking the chosen mic (or the system default
 *  input if none is chosen):
 *  - noise suppression 'none':  a pactl loopback straight into the virtual mic.
 *  - noise suppression 'local' / 'local-light': the on-device denoise pipe instead (a loopback as well would play
 *    the voice twice). If the pipe can't run, fall back to the plain loopback so the user is never
 *    left with no mic at all, and surface why.
 *  Serialized, because it's triggered from IPC calls and from the default-source watcher. */
function applyMicRouting(): Promise<void> {
  routingQueue = routingQueue.then(doApplyMicRouting, doApplyMicRouting)
  return routingQueue
}

async function doApplyMicRouting(): Promise<void> {
  state.defaultSourceName = await resolveDefaultSource()
  const target = state.sinkModuleId !== null ? state.selectedMicSource ?? state.defaultSourceName : null

  let wantDenoise = target !== null && state.noiseSuppression !== 'none'
  const wantLight = state.noiseSuppression === 'local-light'
  if (!wantDenoise || state.denoise?.sourceName !== target || state.denoise.light !== wantLight) {
    if (state.denoise) stopDenoise()
  }
  if (wantDenoise && target && !state.denoise) {
    try {
      const pipe = await startDenoisePipe(
        target,
        VIRTUAL_SINK_NAME,
        state.micLoopbackVolumePercent / 100,
        { light: wantLight, strength: state.noiseSuppressionStrength / 100 },
        (reason) => handleDenoiseDied(target, reason)
      )
      state.denoise = { sourceName: target, light: wantLight, pipe }
      state.noiseSuppressionError = null
    } catch (err) {
      state.noiseSuppressionError = `Noise suppression couldn't start (${err instanceof Error ? err.message : String(err)}).`
      wantDenoise = false
    }
  }

  const wantedLoopback = wantDenoise ? null : target
  if (wantedLoopback === state.micSourceName && (wantedLoopback === null || state.loopbackModuleId !== null)) return
  await unloadLoopback()
  if (wantedLoopback) await loadLoopback(wantedLoopback)
}

/** The denoise pipe died by itself (device unplugged, parec/pacat killed...). Try again shortly;
 *  if it keeps dying, give up and leave the plain loopback in place with an explanation. */
function handleDenoiseDied(sourceName: string, reason: string): void {
  if (state.denoise?.sourceName === sourceName) state.denoise = null
  const now = Date.now()
  denoiseRetries = denoiseRetries.filter((t) => now - t < 60_000)
  denoiseRetries.push(now)
  if (denoiseRetries.length > 3) {
    state.noiseSuppressionError = `Noise suppression stopped (${reason}); the mic is passing through unprocessed.`
    state.noiseSuppression = 'none'
  }
  setTimeout(() => {
    void applyMicRouting()
      .then(() => onRoutingChanged?.(getStatus()))
      .catch(() => {})
  }, 1000)
}

export async function setMicSource(sourceName: string | null): Promise<VirtualMicStatus> {
  state.selectedMicSource = sourceName
  await applyMicRouting()
  return getStatus()
}

export async function setNoiseSuppression(mode: NoiseSuppressionMode): Promise<VirtualMicStatus> {
  state.noiseSuppression = mode
  denoiseRetries = []
  state.noiseSuppressionError = null
  await applyMicRouting()
  return getStatus()
}

/** Live update of the noise suppression strength slider; no pipeline restart needed. */
export function setNoiseSuppressionStrength(percent: number): void {
  state.noiseSuppressionStrength = percent
  state.denoise?.pipe.setStrength(percent / 100)
}

let subscribeProcess: ChildProcess | null = null
let subscribeStopped = false

/** Re-resolves the system default input whenever the audio server reports a change. Needed
 *  because `pactl set-default-source` doesn't alter the device list, so nothing else (e.g.
 *  Chromium's devicechange) would ever tell us the default moved. `onChange` fires only when the
 *  usable default actually changed, after the loopback (if any) has been re-pointed. */
export function startDefaultSourceWatcher(onChange: (status: VirtualMicStatus) => void): void {
  subscribeStopped = false
  onRoutingChanged = onChange
  let debounce: ReturnType<typeof setTimeout> | null = null

  const handleServerChange = (): void => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(async () => {
      if (state.sinkModuleId === null) return
      const before = state.defaultSourceName
      await applyMicRouting().catch(() => {})
      if (state.defaultSourceName !== before) onChange(getStatus())
    }, 200)
  }

  const launch = (): void => {
    if (subscribeStopped) return
    const child = spawn('pactl', ['subscribe'], { stdio: ['ignore', 'pipe', 'ignore'] })
    subscribeProcess = child
    let buffered = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString()
      const lines = buffered.split('\n')
      buffered = lines.pop() ?? ''
      if (lines.some((l) => /'change' on server/.test(l))) handleServerChange()
    })
    const retry = (): void => {
      if (subscribeProcess === child) subscribeProcess = null
      if (!subscribeStopped) setTimeout(launch, 2000)
    }
    child.on('exit', retry)
    child.on('error', retry)
  }
  launch()
}

export function stopDefaultSourceWatcher(): void {
  subscribeStopped = true
  subscribeProcess?.kill()
  subscribeProcess = null
}

export async function setMicLoopbackVolumePercent(percent: number): Promise<VirtualMicStatus> {
  state.micLoopbackVolumePercent = percent
  state.denoise?.pipe.setGain(percent / 100)
  if (state.loopbackSinkInputIndex !== null) {
    await pactl(['set-sink-input-volume', String(state.loopbackSinkInputIndex), `${percent}%`])
  }
  return getStatus()
}
