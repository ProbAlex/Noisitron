import { contextBridge, ipcRenderer } from 'electron'
import type { AudioDevice, Settings, Sound, VirtualMicStatus } from '../shared/types'

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
    remove: (id: string): Promise<Sound[]> => ipcRenderer.invoke('sounds:remove', id),
    setVolume: (id: string, volume: number): Promise<Sound[]> =>
      ipcRenderer.invoke('sounds:setVolume', id, volume),
    readFile: (filePath: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('sounds:readFile', filePath)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
