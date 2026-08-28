import { execFile } from 'child_process'
import { VIRTUAL_MIC_SINK_DESCRIPTION, type AudioDevice, type VirtualMicStatus } from '../shared/types'

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
  micSourceName: string | null
  micLoopbackVolumePercent: number
}

const state: InternalState = {
  sinkModuleId: null,
  sourceModuleId: null,
  loopbackModuleId: null,
  loopbackSinkInputIndex: null,
  micSourceName: null,
  micLoopbackVolumePercent: 100
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
    micSourceName: state.micSourceName,
    micLoopbackVolumePercent: state.micLoopbackVolumePercent
  }
}

export async function createVirtualMic(micSourceName: string | null): Promise<VirtualMicStatus> {
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
  if (micSourceName) {
    await setMicSource(micSourceName)
  }
  return getStatus()
}

export async function destroyVirtualMic(): Promise<void> {
  await unloadLoopback()
  await unloadVirtualSource()
  if (state.sinkModuleId) {
    await pactl(['unload-module', state.sinkModuleId]).catch(() => {})
  }
  state.sinkModuleId = null
}

export async function setMicSource(sourceName: string | null): Promise<VirtualMicStatus> {
  await unloadLoopback()
  if (sourceName && state.sinkModuleId !== null) {
    await loadLoopback(sourceName)
  } else {
    state.micSourceName = sourceName
  }
  return getStatus()
}

export async function setMicLoopbackVolumePercent(percent: number): Promise<VirtualMicStatus> {
  state.micLoopbackVolumePercent = percent
  if (state.loopbackSinkInputIndex !== null) {
    await pactl(['set-sink-input-volume', String(state.loopbackSinkInputIndex), `${percent}%`])
  }
  return getStatus()
}
