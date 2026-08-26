import type { Sound } from '@shared/types'

const MIME_BY_EXT: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/ogg',
  webm: 'audio/webm'
}

interface PlayingInstance {
  soundId: string
  baseVolume: number
  micEl: HTMLAudioElement
  headphoneEl: HTMLAudioElement
}

/** Any HTMLMediaElement whose sink can be redirected away from the OS default output. */
type SinkableAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }

function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export class SoundPlayer {
  private micSinkDeviceId: string | null = null
  private headphoneSinkDeviceId: string | null = null
  private globalMicVolume = 1
  private globalHeadphoneVolume = 1
  private objectUrlCache = new Map<string, string>()
  private active: PlayingInstance[] = []
  private onActiveChange: ((ids: Set<string>) => void) | null = null

  setActiveChangeListener(cb: (ids: Set<string>) => void): void {
    this.onActiveChange = cb
  }

  setMicSinkDeviceId(id: string | null): void {
    this.micSinkDeviceId = id
  }

  setHeadphoneSinkDeviceId(id: string | null): void {
    this.headphoneSinkDeviceId = id
  }

  setGlobalMicVolume(v: number): void {
    this.globalMicVolume = clampVolume(v)
    for (const inst of this.active) {
      inst.micEl.volume = clampVolume(inst.baseVolume * this.globalMicVolume)
    }
  }

  setGlobalHeadphoneVolume(v: number): void {
    this.globalHeadphoneVolume = clampVolume(v)
    for (const inst of this.active) {
      inst.headphoneEl.volume = clampVolume(inst.baseVolume * this.globalHeadphoneVolume)
    }
  }

  /** Applies a live volume change to any currently-playing instances of this sound. */
  updateSoundVolume(soundId: string, volume: number): void {
    for (const inst of this.active) {
      if (inst.soundId !== soundId) continue
      inst.baseVolume = volume
      inst.micEl.volume = clampVolume(volume * this.globalMicVolume)
      inst.headphoneEl.volume = clampVolume(volume * this.globalHeadphoneVolume)
    }
  }

  isPlaying(soundId: string): boolean {
    return this.active.some((i) => i.soundId === soundId)
  }

  private async getObjectUrl(sound: Sound): Promise<string> {
    const cached = this.objectUrlCache.get(sound.filePath)
    if (cached) return cached
    const bytes = await window.api.sounds.readFile(sound.filePath)
    const mime = MIME_BY_EXT[sound.ext] ?? 'audio/*'
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const blob = new Blob([buffer], { type: mime })
    const url = URL.createObjectURL(blob)
    this.objectUrlCache.set(sound.filePath, url)
    return url
  }

  private async routeSink(el: SinkableAudio, deviceId: string | null): Promise<void> {
    if (!deviceId || typeof el.setSinkId !== 'function') return
    try {
      await el.setSinkId(deviceId)
    } catch {
      // Device may have disappeared; playback still proceeds on the default sink.
    }
  }

  private emitActiveChange(): void {
    this.onActiveChange?.(new Set(this.active.map((i) => i.soundId)))
  }

  private removeInstance(inst: PlayingInstance): void {
    this.active = this.active.filter((i) => i !== inst)
    this.emitActiveChange()
  }

  async play(sound: Sound): Promise<void> {
    const url = await this.getObjectUrl(sound)

    const micEl = new Audio(url) as SinkableAudio
    const headphoneEl = new Audio(url) as SinkableAudio
    micEl.volume = clampVolume(sound.volume * this.globalMicVolume)
    headphoneEl.volume = clampVolume(sound.volume * this.globalHeadphoneVolume)

    await Promise.all([
      this.routeSink(micEl, this.micSinkDeviceId),
      this.routeSink(headphoneEl, this.headphoneSinkDeviceId)
    ])

    const instance: PlayingInstance = { soundId: sound.id, baseVolume: sound.volume, micEl, headphoneEl }

    let endedCount = 0
    const handleEnded = (): void => {
      endedCount += 1
      if (endedCount >= 2) this.removeInstance(instance)
    }
    micEl.addEventListener('ended', handleEnded)
    headphoneEl.addEventListener('ended', handleEnded)
    micEl.addEventListener('error', handleEnded)
    headphoneEl.addEventListener('error', handleEnded)

    this.active.push(instance)
    this.emitActiveChange()

    await Promise.allSettled([micEl.play(), headphoneEl.play()])
  }

  stopSound(soundId: string): void {
    const instances = this.active.filter((i) => i.soundId === soundId)
    for (const inst of instances) {
      inst.micEl.pause()
      inst.headphoneEl.pause()
    }
    this.active = this.active.filter((i) => i.soundId !== soundId)
    this.emitActiveChange()
  }

  stopAll(): void {
    for (const inst of this.active) {
      inst.micEl.pause()
      inst.headphoneEl.pause()
    }
    this.active = []
    this.emitActiveChange()
  }
}

export const soundPlayer = new SoundPlayer()
