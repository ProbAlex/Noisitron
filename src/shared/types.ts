/** device.description set on the null-sink; used by the renderer to match it
 *  against navigator.mediaDevices output labels so it can be selected as a
 *  Web Audio / <audio> sink target. */
export const VIRTUAL_MIC_SINK_DESCRIPTION = 'Soundboard_Virtual_Mic'

export interface AudioDevice {
  /** pactl/pipewire node name, e.g. alsa_input.pci-..._Mic1__source */
  name: string
  /** human readable device.description */
  description: string
  index: number
}

export interface VirtualMicStatus {
  active: boolean
  /** name of the null-sink the soundboard routes audio into */
  sinkName: string
  /** name of the standalone virtual microphone source Discord (or any app) should select as input */
  monitorSourceName: string
  micSourceName: string | null
  micLoopbackVolumePercent: number
}

export interface Sound {
  id: string
  name: string
  /** absolute path under userData/sounds where the imported file was copied */
  filePath: string
  /** original file extension, lowercase, no dot */
  ext: string
  /** 0 - 1.5, per-sound gain applied on top of the global bus volumes */
  volume: number
}

export interface Settings {
  sounds: Sound[]
  micSourceName: string | null
  headphoneSinkName: string | null
  globalMicVolume: number
  globalHeadphoneVolume: number
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: [],
  micSourceName: null,
  headphoneSinkName: null,
  globalMicVolume: 1,
  globalHeadphoneVolume: 1
}

export interface ImportedSoundFile {
  filePath: string
  name: string
  ext: string
}
