import { create } from 'zustand'
import type { AudioDevice, Sound, VirtualMicStatus } from '@shared/types'
import { VIRTUAL_MIC_SINK_DESCRIPTION } from '@shared/types'
import { soundPlayer } from '../audio/player'
import { findOutputDeviceId } from '../audio/deviceMatch'

const volumeSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface SoundboardState {
  ready: boolean
  errorMessage: string | null

  sounds: Sound[]
  sourceDevices: AudioDevice[]
  sinkDevices: AudioDevice[]

  micSourceName: string | null
  headphoneSinkName: string | null
  globalMicVolume: number
  globalHeadphoneVolume: number

  micStatus: VirtualMicStatus | null
  activeSoundIds: Set<string>

  init: () => Promise<void>
  refreshRouting: () => Promise<void>
  reconnectVirtualMic: () => Promise<void>

  importSounds: () => Promise<void>
  removeSound: (id: string) => Promise<void>
  setSoundVolume: (id: string, volume: number) => void
  renameSound: (id: string, name: string) => void

  playSound: (sound: Sound) => Promise<void>
  stopSound: (id: string) => void

  setMicSourceName: (name: string | null) => Promise<void>
  setHeadphoneSinkName: (name: string | null) => Promise<void>
  setGlobalMicVolume: (v: number) => void
  setGlobalHeadphoneVolume: (v: number) => void
  setMicInputVolumePercent: (percent: number) => Promise<void>
}

export const useSoundboardStore = create<SoundboardState>((set, get) => ({
  ready: false,
  errorMessage: null,

  sounds: [],
  sourceDevices: [],
  sinkDevices: [],

  micSourceName: null,
  headphoneSinkName: null,
  globalMicVolume: 1,
  globalHeadphoneVolume: 1,

  micStatus: null,
  activeSoundIds: new Set(),

  init: async () => {
    soundPlayer.setActiveChangeListener((ids) => set({ activeSoundIds: ids }))

    try {
      // Unlocks real device labels for navigator.mediaDevices.enumerateDevices().
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      // Non-fatal: output-device labels may be missing, matching falls back to best-effort.
    }

    navigator.mediaDevices.addEventListener('devicechange', () => {
      get().refreshRouting()
    })

    const [settings, sourceDevices, sinkDevices] = await Promise.all([
      window.api.settings.get(),
      window.api.devices.listSources(),
      window.api.devices.listSinks()
    ])

    soundPlayer.setGlobalMicVolume(settings.globalMicVolume)
    soundPlayer.setGlobalHeadphoneVolume(settings.globalHeadphoneVolume)

    set({
      sounds: settings.sounds,
      micSourceName: settings.micSourceName,
      headphoneSinkName: settings.headphoneSinkName,
      globalMicVolume: settings.globalMicVolume,
      globalHeadphoneVolume: settings.globalHeadphoneVolume,
      sourceDevices,
      sinkDevices
    })

    await get().reconnectVirtualMic()
    await get().refreshRouting()
    set({ ready: true })
  },

  refreshRouting: async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const micSinkId = findOutputDeviceId(devices, VIRTUAL_MIC_SINK_DESCRIPTION)
    soundPlayer.setMicSinkDeviceId(micSinkId)

    const { headphoneSinkName, sinkDevices } = get()
    const headphoneDesc = sinkDevices.find((d) => d.name === headphoneSinkName)?.description ?? null
    const headphoneId = findOutputDeviceId(devices, headphoneDesc)
    soundPlayer.setHeadphoneSinkDeviceId(headphoneId)
  },

  reconnectVirtualMic: async () => {
    try {
      const status = await window.api.virtualMic.create()
      set({ micStatus: status, errorMessage: null })
      await get().refreshRouting()
    } catch (err) {
      set({
        errorMessage:
          err instanceof Error
            ? `Couldn't set up the virtual microphone: ${err.message}`
            : "Couldn't set up the virtual microphone."
      })
    }
  },

  importSounds: async () => {
    const sounds = await window.api.sounds.import()
    set({ sounds })
  },

  removeSound: async (id) => {
    get().stopSound(id)
    const sounds = await window.api.sounds.remove(id)
    set({ sounds })
  },

  setSoundVolume: (id, volume) => {
    set((state) => ({
      sounds: state.sounds.map((s) => (s.id === id ? { ...s, volume } : s))
    }))
    soundPlayer.updateSoundVolume(id, volume)

    const existing = volumeSaveTimers.get(id)
    if (existing) clearTimeout(existing)
    volumeSaveTimers.set(
      id,
      setTimeout(() => {
        window.api.sounds.setVolume(id, volume)
        volumeSaveTimers.delete(id)
      }, 250)
    )
  },

  renameSound: (id, name) => {
    set((state) => ({
      sounds: state.sounds.map((s) => (s.id === id ? { ...s, name } : s))
    }))
  },

  playSound: async (sound) => {
    await soundPlayer.play(sound)
  },

  stopSound: (id) => {
    soundPlayer.stopSound(id)
  },

  setMicSourceName: async (name) => {
    set({ micSourceName: name })
    const status = await window.api.virtualMic.setMicSource(name)
    set({ micStatus: status })
  },

  setHeadphoneSinkName: async (name) => {
    set({ headphoneSinkName: name })
    window.api.settings.setHeadphoneSink(name)
    await get().refreshRouting()
  },

  setGlobalMicVolume: (v) => {
    set({ globalMicVolume: v })
    soundPlayer.setGlobalMicVolume(v)
    window.api.settings.setGlobalMicVolume(v)
  },

  setGlobalHeadphoneVolume: (v) => {
    set({ globalHeadphoneVolume: v })
    soundPlayer.setGlobalHeadphoneVolume(v)
    window.api.settings.setGlobalHeadphoneVolume(v)
  },

  setMicInputVolumePercent: async (percent) => {
    const status = await window.api.virtualMic.setMicVolume(percent)
    set({ micStatus: status })
  }
}))
