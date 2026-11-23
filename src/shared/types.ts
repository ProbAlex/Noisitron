/** device.description set on the null-sink; used by the renderer to match it
 *  against navigator.mediaDevices output labels so it can be selected as a
 *  Web Audio / <audio> sink target. */
export const VIRTUAL_MIC_SINK_DESCRIPTION = 'Noisitron_Virtual_Mic'

/** How the microphone is cleaned up before it's mixed into the virtual mic.
 *  - none:  straight PulseAudio/PipeWire loopback, no processing.
 *  - local: processed on this machine (RNNoise running in the main process), nothing leaves the device. */
export type NoiseSuppressionMode = 'none' | 'local'

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
  /** the input currently feeding the virtual mic (through the pactl loopback, or through the
   *  noise-suppression pipe); null when there is no usable mic. */
  micSourceName: string | null
  micLoopbackVolumePercent: number
  /** the system's current default input, when it's usable as a mic (never our own virtual mic
   *  or a monitor source); null if there isn't one. Used when no mic is explicitly selected. */
  defaultSourceName: string | null
  /** true while the on-device denoiser is actually processing the mic. */
  noiseSuppressionActive: boolean
  /** why local noise suppression isn't running even though it's selected (the mic is then passed
   *  through unprocessed instead), or null. */
  noiseSuppressionError: string | null
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
  /** id of the Folder this sound is grouped under, or null for ungrouped */
  folderId: string | null
  /** emoji shown on the tile; mutually exclusive with imagePath */
  emoji: string | null
  /** absolute path under userData/icons to a custom thumbnail; mutually exclusive with emoji */
  imagePath: string | null
  /** Electron accelerator string (e.g. "Control+Alt+F1") that triggers this sound system-wide */
  keybind: string | null
  /** absolute path of the original file this was copied from, if imported via a folder or
   *  file picker; used to detect "already imported" when re-syncing a folder. Null for sounds
   *  that predate this field. */
  sourcePath: string | null
}

export interface Folder {
  id: string
  name: string
  /** absolute path of the directory this folder was imported from, if any; re-syncing
   *  requires this. Null for folders that predate this field. */
  sourcePath: string | null
  /** id of the Folder this one is nested under, or null for a top-level folder. */
  parentId: string | null
}

export interface Settings {
  sounds: Sound[]
  folders: Folder[]
  /** explicitly chosen microphone; null means "System default" (follows the OS default input). */
  micSourceName: string | null
  noiseSuppression: NoiseSuppressionMode
  headphoneSinkName: string | null
  globalMicVolume: number
  globalHeadphoneVolume: number
  /** id of the auto-created "Store" folder downloads land in; tracked by id (not name) so
   *  renaming that folder doesn't orphan future downloads. Null until the first download. */
  storeFolderId: string | null
  /** app version that last opened this config; when it differs on launch, the config is
   *  backed up before any migration runs. Null for configs from before this was tracked. */
  lastRunVersion: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: [],
  folders: [],
  micSourceName: null,
  noiseSuppression: 'none',
  headphoneSinkName: null,
  globalMicVolume: 1,
  globalHeadphoneVolume: 1,
  storeFolderId: null,
  lastRunVersion: null
}

/** One search hit from the MyInstants sound store. */
export interface StoreSearchResult {
  /** relative "/media/sounds/....mp3" path on myinstants.com - stable and unique per sound,
   *  used both to fetch it and as its list key (MyInstants exposes no numeric id in search HTML). */
  mp3Path: string
  title: string
}

export interface ImportedSoundFile {
  filePath: string
  name: string
  ext: string
}

export interface SetKeybindResult {
  sounds: Sound[]
  error?: string
}
