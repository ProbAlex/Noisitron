import { create } from 'zustand'
import type { AudioDevice, Folder, Sound, VirtualMicStatus } from '@shared/types'
import { VIRTUAL_MIC_SINK_DESCRIPTION } from '@shared/types'
import { soundPlayer } from '../audio/player'
import { findOutputDeviceId } from '../audio/deviceMatch'

const volumeSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface SoundboardState {
  ready: boolean
  errorMessage: string | null

  sounds: Sound[]
  folders: Folder[]
  selectedFolderId: string | null

  sourceDevices: AudioDevice[]
  sinkDevices: AudioDevice[]

  micSourceName: string | null
  headphoneSinkName: string | null
  globalMicVolume: number
  globalHeadphoneVolume: number

  micStatus: VirtualMicStatus | null
  activeSoundIds: Set<string>

  globalShortcutsSupported: boolean

  contextMenu: { soundId: string; x: number; y: number } | null
  openSoundMenu: (soundId: string, x: number, y: number) => void
  closeSoundMenu: () => void

  init: () => Promise<void>
  refreshRouting: () => Promise<void>
  refreshDevices: () => Promise<void>
  reconnectVirtualMic: () => Promise<void>

  importSounds: () => Promise<void>
  importFolder: () => Promise<void>
  removeSound: (id: string) => Promise<void>
  setSoundVolume: (id: string, volume: number) => void
  renameSound: (id: string, name: string) => void
  setSoundFolder: (id: string, folderId: string | null) => Promise<void>
  setSoundEmoji: (id: string, emoji: string | null) => Promise<void>
  pickSoundImage: (id: string) => Promise<void>
  clearSoundIcon: (id: string) => Promise<void>
  setSoundKeybind: (id: string, accelerator: string | null) => Promise<{ ok: boolean; error?: string }>

  renameFolder: (id: string, name: string) => Promise<void>
  removeFolder: (id: string) => Promise<void>
  selectFolder: (id: string | null) => void

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
  folders: [],
  selectedFolderId: null,

  sourceDevices: [],
  sinkDevices: [],

  micSourceName: null,
  headphoneSinkName: null,
  globalMicVolume: 1,
  globalHeadphoneVolume: 1,

  micStatus: null,
  activeSoundIds: new Set(),

  globalShortcutsSupported: true,

  contextMenu: null,
  openSoundMenu: (soundId, x, y) => set({ contextMenu: { soundId, x, y } }),
  closeSoundMenu: () => set({ contextMenu: null }),

  init: async () => {
    // Registered first (synchronously, before any await below) so it's already
    // listening by the time the main process flushes a queued Stream Deck / hotkey
    // play request on did-finish-load.
    window.api.app.onPlayRequested((soundId) => {
      const sound = get().sounds.find((s) => s.id === soundId)
      if (sound) void get().playSound(sound)
    })

    soundPlayer.setActiveChangeListener((ids) => set({ activeSoundIds: ids }))

    try {
      // Unlocks real device labels for navigator.mediaDevices.enumerateDevices().
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      // Non-fatal: output-device labels may be missing, matching falls back to best-effort.
    }

    navigator.mediaDevices.addEventListener('devicechange', () => {
      void get().refreshDevices()
    })

    const [settings, sourceDevices, sinkDevices, capabilities] = await Promise.all([
      window.api.settings.get(),
      window.api.devices.listSources(),
      window.api.devices.listSinks(),
      window.api.app.getCapabilities()
    ])

    soundPlayer.setGlobalMicVolume(settings.globalMicVolume)
    soundPlayer.setGlobalHeadphoneVolume(settings.globalHeadphoneVolume)

    set({
      sounds: settings.sounds,
      folders: settings.folders,
      micSourceName: settings.micSourceName,
      headphoneSinkName: settings.headphoneSinkName,
      globalMicVolume: settings.globalMicVolume,
      globalHeadphoneVolume: settings.globalHeadphoneVolume,
      sourceDevices,
      sinkDevices,
      globalShortcutsSupported: capabilities.globalShortcuts
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

  refreshDevices: async () => {
    const [sourceDevices, sinkDevices] = await Promise.all([
      window.api.devices.listSources(),
      window.api.devices.listSinks()
    ])
    set({ sourceDevices, sinkDevices })
    await get().refreshRouting()
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

  importFolder: async () => {
    const { sounds, folders } = await window.api.sounds.importFolder()
    set({ sounds, folders })
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
    window.api.sounds.rename(id, name).then((sounds) => set({ sounds }))
  },

  setSoundFolder: async (id, folderId) => {
    set((state) => ({
      sounds: state.sounds.map((s) => (s.id === id ? { ...s, folderId } : s))
    }))
    const sounds = await window.api.sounds.setFolder(id, folderId)
    set({ sounds })
  },

  setSoundEmoji: async (id, emoji) => {
    const sounds = await window.api.sounds.setEmoji(id, emoji)
    set({ sounds })
  },

  pickSoundImage: async (id) => {
    const sounds = await window.api.sounds.pickImage(id)
    set({ sounds })
  },

  clearSoundIcon: async (id) => {
    const sounds = await window.api.sounds.clearIcon(id)
    set({ sounds })
  },

  setSoundKeybind: async (id, accelerator) => {
    const result = await window.api.sounds.setKeybind(id, accelerator)
    set({ sounds: result.sounds })
    return { ok: !result.error, error: result.error }
  },

  renameFolder: async (id, name) => {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f))
    }))
    const folders = await window.api.folders.rename(id, name)
    set({ folders })
  },

  removeFolder: async (id) => {
    const { sounds, folders } = await window.api.folders.remove(id)
    set((state) => ({
      sounds,
      folders,
      selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId
    }))
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

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
