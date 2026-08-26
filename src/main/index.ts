import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join, extname, basename } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import Store from 'electron-store'
import * as audio from './audio'
import { DEFAULT_SETTINGS, type Settings, type Sound } from '../shared/types'

const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'webm']

let store: Store<Settings>
let mainWindow: BrowserWindow | null = null

function getSoundsDir(): string {
  return join(app.getPath('userData'), 'sounds')
}

function persistedSounds(): Sound[] {
  return store.get('sounds')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 760,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#111318',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('devices:listSources', () => audio.listSources())
  ipcMain.handle('devices:listSinks', () => audio.listSinks())

  ipcMain.handle('virtualMic:status', () => audio.getStatus())
  ipcMain.handle('virtualMic:create', () => audio.createVirtualMic(store.get('micSourceName')))
  ipcMain.handle('virtualMic:destroy', () => audio.destroyVirtualMic())
  ipcMain.handle('virtualMic:setMicSource', async (_e, sourceName: string | null) => {
    store.set('micSourceName', sourceName)
    return audio.setMicSource(sourceName)
  })
  ipcMain.handle('virtualMic:setMicVolume', async (_e, percent: number) => {
    return audio.setMicLoopbackVolumePercent(percent)
  })

  ipcMain.handle('settings:get', () => store.store)
  ipcMain.handle('settings:setHeadphoneSink', (_e, sinkName: string | null) => {
    store.set('headphoneSinkName', sinkName)
  })
  ipcMain.handle('settings:setGlobalMicVolume', (_e, v: number) => {
    store.set('globalMicVolume', v)
  })
  ipcMain.handle('settings:setGlobalHeadphoneVolume', (_e, v: number) => {
    store.set('globalHeadphoneVolume', v)
  })

  ipcMain.handle('sounds:import', async () => {
    if (!mainWindow) return persistedSounds()
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import sounds',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ALLOWED_EXTENSIONS }]
    })
    if (result.canceled || result.filePaths.length === 0) return persistedSounds()

    const soundsDir = getSoundsDir()
    const sounds = persistedSounds()
    for (const srcPath of result.filePaths) {
      const ext = extname(srcPath).slice(1).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) continue
      const id = randomUUID()
      const destPath = join(soundsDir, `${id}.${ext}`)
      await fs.copyFile(srcPath, destPath)
      sounds.push({
        id,
        name: basename(srcPath, extname(srcPath)),
        filePath: destPath,
        ext,
        volume: 1
      })
    }
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:remove', async (_e, id: string) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) {
      await fs.unlink(target.filePath).catch(() => {})
    }
    const updated = sounds.filter((s) => s.id !== id)
    store.set('sounds', updated)
    return updated
  })

  ipcMain.handle('sounds:setVolume', (_e, id: string, volume: number) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) target.volume = volume
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:readFile', async (_e, filePath: string) => {
    const soundsDir = getSoundsDir()
    if (!filePath.startsWith(soundsDir)) {
      throw new Error('Refusing to read file outside the soundboard library')
    }
    return fs.readFile(filePath)
  })
}

let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  // Electron's own shutdown can occasionally stall tearing down the
  // GPU/renderer processes; force-exit rather than leave a zombie process
  // once our pactl cleanup is done (or has had a fair chance to run).
  const forceExit = setTimeout(() => app.exit(0), 4000)
  audio
    .destroyVirtualMic()
    .catch(() => {})
    .finally(() => {
      clearTimeout(forceExit)
      app.exit(0)
    })
})

app.whenReady().then(async () => {
  store = new Store<Settings>({ defaults: DEFAULT_SETTINGS })

  await fs.mkdir(getSoundsDir(), { recursive: true })
  await audio.cleanupStaleModules().catch(() => {})

  // The app requests mic access purely so navigator.mediaDevices.enumerateDevices()
  // returns real device labels (needed to match a device against the virtual sink
  // we create) - it never actually records audio from it.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
