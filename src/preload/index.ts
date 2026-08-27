import { contextBridge, ipcRenderer } from 'electron'
import type { AudioDevice, Folder, Settings, Sound, VirtualMicStatus, SetKeybindResult } from '../shared/types'

const api = {
  devices: {
    listSources: (): Promise<AudioDevice[]> => ipcRenderer.invoke('devices:listSources'),
    listSinks: (): Promise<AudioDevice[]> => ipcRenderer.invoke('devices:listSinks')
  },
  virtualMic: {
    status: (): Promise<VirtualMicStatus> => ipcRenderer.invoke('virtualMic:status'),
    create: (): Promise<VirtualMicStatus> => ipcRenderer.invoke('virtualMic:create'),
    destroy: (): Promise<void> => ipcRenderer.invoke('virtualMic:destroy'),
    setMicSource: (sourceName: string | null): Promise<VirtualMicStatus> =>
      ipcRenderer.invoke('virtualMic:setMicSource', sourceName),
    setMicVolume: (percent: number): Promise<VirtualMicStatus> =>
      ipcRenderer.invoke('virtualMic:setMicVolume', percent)
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    setHeadphoneSink: (sinkName: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:setHeadphoneSink', sinkName),
    setGlobalMicVolume: (v: number): Promise<void> =>
      ipcRenderer.invoke('settings:setGlobalMicVolume', v),
    setGlobalHeadphoneVolume: (v: number): Promise<void> =>
      ipcRenderer.invoke('settings:setGlobalHeadphoneVolume', v)
  },
  sounds: {
    import: (): Promise<Sound[]> => ipcRenderer.invoke('sounds:import'),
    importFolder: (): Promise<{ sounds: Sound[]; folders: Folder[] }> =>
      ipcRenderer.invoke('sounds:importFolder'),
    remove: (id: string): Promise<Sound[]> => ipcRenderer.invoke('sounds:remove', id),
    setVolume: (id: string, volume: number): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:setVolume', id, volume),
    rename: (id: string, name: string): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:rename', id, name),
    setFolder: (id: string, folderId: string | null): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:setFolder', id, folderId),
    setEmoji: (id: string, emoji: string | null): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:setEmoji', id, emoji),
    pickImage: (id: string): Promise<Sound[]> => ipcRenderer.invoke('sounds:pickImage', id),
    clearIcon: (id: string): Promise<Sound[]> => ipcRenderer.invoke('sounds:clearIcon', id),
    setKeybind: (id: string, accelerator: string | null): Promise<SetKeybindResult> =>
      ipcRenderer.invoke('sounds:setKeybind', id, accelerator),
    readFile: (filePath: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('sounds:readFile', filePath),
    readIcon: (filePath: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('sounds:readIcon', filePath),
    trim: (id: string, bytes: Uint8Array): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:trim', id, bytes)
  },
  folders: {
    rename: (id: string, name: string): Promise<Folder[]> =>
      ipcRenderer.invoke('folders:rename', id, name),
    remove: (id: string): Promise<{ sounds: Sound[]; folders: Folder[] }> =>
      ipcRenderer.invoke('folders:remove', id),
    sync: (id: string): Promise<{ sounds: Sound[]; folders: Folder[] }> =>
      ipcRenderer.invoke('folders:sync', id)
  },
  app: {
    getExecPath: (): Promise<string> => ipcRenderer.invoke('app:getExecPath'),
    getCapabilities: (): Promise<{ globalShortcuts: boolean }> =>
      ipcRenderer.invoke('app:getCapabilities'),
    openSoundsFolder: (): Promise<void> => ipcRenderer.invoke('app:openSoundsFolder'),
    copyToClipboard: (text: string): Promise<void> => ipcRenderer.invoke('app:copyToClipboard', text),
    onPlayRequested: (callback: (soundId: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, soundId: string): void => callback(soundId)
      ipcRenderer.on('sounds:playRequested', listener)
      return () => ipcRenderer.removeListener('sounds:playRequested', listener)
    },
    onLibraryChanged: (callback: (data: { sounds: Sound[]; folders: Folder[] }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sounds: Sound[]; folders: Folder[] }
      ): void => callback(data)
      ipcRenderer.on('library:changed', listener)
      return () => ipcRenderer.removeListener('library:changed', listener)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
