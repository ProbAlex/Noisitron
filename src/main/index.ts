import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  globalShortcut,
  clipboard,
  Tray,
  Menu,
  nativeImage
} from 'electron'
import { join, extname, basename } from 'path'
import { promises as fs, watch as watchFs, type FSWatcher } from 'fs'
import { randomUUID } from 'crypto'
import Store from 'electron-store'
import * as audio from './audio'
import { DEFAULT_SETTINGS, type Settings, type Sound, type Folder } from '../shared/types'

const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'webm']
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

let store: Store<Settings>
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let windowReady = false
/** Set only by an explicit Quit (tray menu / Settings button). Until then, closing the
 *  window (native X, a WM close shortcut like Super+Q, etc.) just hides it, so global
 *  keybinds and the CLI/Stream Deck trigger keep working without the GUI popping back up.
 *  Deliberately separate from before-quit's own one-shot cleanup guard below - conflating
 *  them would make it skip the virtual-mic cleanup whenever this is set first. */
let quitRequested = false
const pendingPlayRequests: string[] = []

function getSoundsDir(): string {
  return join(app.getPath('userData'), 'sounds')
}

function getIconsDir(): string {
  return join(app.getPath('userData'), 'icons')
}

function getIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')
}

/** The command a Stream Deck button / shell alias should invoke, resolved for however
 *  this copy of the app is actually running - never hard-coded to a single install style.
 *  Running as an AppImage, `app.getPath('exe')` points at the *mounted, temporary* copy
 *  under /tmp/.mountXXXXXX/..., which changes every launch - AppImage's own runtime sets
 *  $APPIMAGE to the real, stable .AppImage path, so prefer that when it's set. Otherwise
 *  (a .deb/.rpm/AUR install on PATH) the resolved executable path is already correct and
 *  stable as-is - but running *unpackaged* in dev, `app.getPath('exe')` is the bare
 *  electron binary, which needs an explicit app-directory argument or it falls back to
 *  Electron's own "To run a local app..." default screen instead of loading Noisitron. */
function getInvocationCommand(): string {
  const exe = process.env.APPIMAGE || app.getPath('exe')
  if (!app.isPackaged) return `${exe} "${app.getAppPath()}"`
  return exe
}

function persistedSounds(): Sound[] {
  return store.get('sounds')
}

function persistedFolders(): Folder[] {
  return store.get('folders') ?? []
}

/** Fills in fields added after a user's library was first created. */
function migrateSounds(): void {
  const sounds = store.get('sounds').map((s) => ({
    folderId: null,
    emoji: null,
    imagePath: null,
    keybind: null,
    sourcePath: null,
    ...(s as Partial<Sound>)
  })) as Sound[]
  store.set('sounds', sounds)

  if (!store.has('folders')) {
    store.set('folders', [])
  } else {
    const folders = store.get('folders').map((f) => ({
      sourcePath: null,
      parentId: null,
      ...(f as Partial<Folder>)
    })) as Folder[]
    store.set('folders', folders)
  }
}

function sendPlayRequest(soundId: string): void {
  if (mainWindow && windowReady) {
    mainWindow.webContents.send('sounds:playRequested', soundId)
  } else {
    pendingPlayRequests.push(soundId)
  }
}

function flushPendingPlayRequests(): void {
  if (!mainWindow) return
  windowReady = true
  for (const id of pendingPlayRequests.splice(0)) {
    mainWindow.webContents.send('sounds:playRequested', id)
  }
}

function normalizeAccelerator(a: string): string {
  return a
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .sort()
    .join('+')
}

/** Some desktop sessions (most Wayland compositors, accessed via XWayland) never grant
 *  apps a real global key grab, so globalShortcut.register() silently fails for every
 *  combination. Probe once at startup with a combo nothing else would plausibly own, so
 *  the UI can explain *why* recording won't work instead of just calling it "reserved". */
let globalShortcutsSupported = true
function probeGlobalShortcutSupport(): void {
  const probe = 'Control+Alt+Shift+F24'
  const ok = globalShortcut.register(probe, () => {})
  if (ok) globalShortcut.unregister(probe)
  globalShortcutsSupported = ok
}

/** Re-registers every sound's global hotkey. Call after any change to the sounds array. */
function syncShortcuts(): void {
  globalShortcut.unregisterAll()
  for (const sound of persistedSounds()) {
    if (!sound.keybind) continue
    globalShortcut.register(sound.keybind, () => sendPlayRequest(sound.id))
  }
}

function resolveSoundForCli(value: string): Sound | undefined {
  const sounds = persistedSounds()
  const byId = sounds.find((s) => s.id === value)
  if (byId) return byId
  const lower = value.toLowerCase()
  const exactName = sounds.find((s) => s.name.toLowerCase() === lower)
  if (exactName) return exactName
  return sounds.find((s) => s.name.toLowerCase().includes(lower))
}

/** Handles `--play=<id-or-name>`, the flag a Stream Deck button invokes the app with. */
function handleCliArgs(argv: string[]): void {
  for (const arg of argv) {
    const match = /^--play=(.+)$/.exec(arg)
    if (!match) continue
    const sound = resolveSoundForCli(match[1])
    if (sound) sendPlayRequest(sound.id)
  }
}

/** `--list-sounds`: read the library straight off disk and exit, no window, no lock needed. */
function printSoundListAndExit(): void {
  const raw = new Store<Settings>({ defaults: DEFAULT_SETTINGS })
  const sounds = raw.get('sounds')
  if (sounds.length === 0) {
    console.log('No sounds imported yet.')
  } else {
    for (const s of sounds) console.log(`${s.id}\t${s.name}`)
  }
  app.exit(0)
}

async function copySoundFilesIntoLibrary(paths: string[], folderId: string | null): Promise<Sound[]> {
  const soundsDir = getSoundsDir()
  const sounds = persistedSounds()
  for (const srcPath of paths) {
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
      volume: 1,
      folderId,
      emoji: null,
      imagePath: null,
      keybind: null,
      sourcePath: srcPath
    })
  }
  store.set('sounds', sounds)
  return sounds
}

/** Audio files directly inside a directory (non-recursive), matching the import filter. */
async function listAudioFilesIn(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile())
    .map((e) => join(dirPath, e.name))
    .filter((p) => ALLOWED_EXTENSIONS.includes(extname(p).slice(1).toLowerCase()))
}

/** Copies in any file from a folder's source directory not already represented by an
 *  existing sound's sourcePath. Additive only - never removes a sound whose source file
 *  disappeared, since the same folder may be shared/edited outside the app. */
async function syncFolder(folderId: string): Promise<Sound[]> {
  const folder = persistedFolders().find((f) => f.id === folderId)
  if (!folder?.sourcePath) return persistedSounds()

  const candidates = await listAudioFilesIn(folder.sourcePath).catch(() => [])
  const known = new Set(persistedSounds().map((s) => s.sourcePath).filter(Boolean))
  const newPaths = candidates.filter((p) => !known.has(p))
  if (newPaths.length === 0) return persistedSounds()

  const sounds = await copySoundFilesIntoLibrary(newPaths, folderId)
  syncShortcuts()
  return sounds
}

/** Re-syncs every folder that has a known source directory. Called once at startup so
 *  simply reopening the app picks up files added to a source folder since last run. */
async function syncAllFolders(): Promise<void> {
  for (const folder of persistedFolders()) {
    if (folder.sourcePath) await syncFolder(folder.id).catch(() => {})
  }
}

const folderWatchers = new Map<string, FSWatcher>()
const folderSyncDebounce = new Map<string, ReturnType<typeof setTimeout>>()

function notifyLibraryChanged(): void {
  mainWindow?.webContents.send('library:changed', {
    sounds: persistedSounds(),
    folders: persistedFolders()
  })
}

/** Live-syncs a folder: any change in its source directory (file added, removed, renamed)
 *  triggers a debounced re-sync while the app is running, no relaunch needed. inotify (via
 *  fs.watch) can fire several events for a single filesystem operation, hence the debounce. */
function watchFolder(folder: Folder): void {
  if (!folder.sourcePath) return
  unwatchFolder(folder.id)
  try {
    const watcher = watchFs(folder.sourcePath, { persistent: true }, () => {
      const existing = folderSyncDebounce.get(folder.id)
      if (existing) clearTimeout(existing)
      folderSyncDebounce.set(
        folder.id,
        setTimeout(() => {
          folderSyncDebounce.delete(folder.id)
          syncFolder(folder.id)
            .then(() => notifyLibraryChanged())
            .catch(() => {})
        }, 500)
      )
    })
    watcher.on('error', () => unwatchFolder(folder.id))
    folderWatchers.set(folder.id, watcher)
  } catch {
    // Source directory may be missing/unmounted/inaccessible - just skip watching it.
  }
}

function unwatchFolder(folderId: string): void {
  folderWatchers.get(folderId)?.close()
  folderWatchers.delete(folderId)
  const timer = folderSyncDebounce.get(folderId)
  if (timer) clearTimeout(timer)
  folderSyncDebounce.delete(folderId)
}

function watchAllFolders(): void {
  for (const folder of persistedFolders()) watchFolder(folder)
}

function createWindow(startHidden: boolean): void {
  mainWindow = new BrowserWindow({
    title: 'Noisitron',
    width: 1180,
    height: 780,
    minWidth: 820,
    minHeight: 580,
    autoHideMenuBar: true,
    backgroundColor: '#0b0c10',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!startHidden) mainWindow?.show()
  })
  // Pending play requests are flushed when the renderer explicitly signals it's listening
  // (app:notifyReady), not on did-finish-load - that event only means the page finished
  // loading, not that React has mounted and registered the IPC listener yet, and a message
  // sent before anyone is listening for it is just lost.

  // Closing the window (native X, a WM close shortcut, etc.) hides it instead of quitting,
  // so the tray-resident app keeps playing sounds via keybinds/CLI. Only an explicit Quit
  // (tray menu / Settings button) sets `quitRequested` and lets the close actually go through.
  mainWindow.on('close', (e) => {
    if (quitRequested) return
    e.preventDefault()
    mainWindow?.hide()
  })

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

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 22, height: 22 })
  tray = new Tray(icon)
  tray.setToolTip('Noisitron')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Noisitron', click: showMainWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitRequested = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
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
    const sounds = await copySoundFilesIntoLibrary(result.filePaths, null)
    syncShortcuts()
    return sounds
  })

  ipcMain.handle('sounds:importFolder', async (_e, parentId: string | null) => {
    if (!mainWindow) return { sounds: persistedSounds(), folders: persistedFolders() }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import folder of sounds',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { sounds: persistedSounds(), folders: persistedFolders() }
    }

    const dirPath = result.filePaths[0]
    const filePaths = await listAudioFilesIn(dirPath)

    const folders = persistedFolders()
    const folder: Folder = { id: randomUUID(), name: basename(dirPath), sourcePath: dirPath, parentId }
    folders.push(folder)
    store.set('folders', folders)
    watchFolder(folder)

    const sounds = await copySoundFilesIntoLibrary(filePaths, folder.id)
    syncShortcuts()
    return { sounds, folders }
  })

  ipcMain.handle('folders:create', (_e, name: string, parentId: string | null) => {
    const folders = persistedFolders()
    const folder: Folder = { id: randomUUID(), name: name.trim() || 'New folder', sourcePath: null, parentId }
    folders.push(folder)
    store.set('folders', folders)
    return folders
  })

  ipcMain.handle('folders:sync', async (_e, id: string) => {
    const sounds = await syncFolder(id)
    return { sounds, folders: persistedFolders() }
  })

  ipcMain.handle('folders:rename', (_e, id: string, name: string) => {
    const folders = persistedFolders()
    const target = folders.find((f) => f.id === id)
    if (target) target.name = name.trim() || target.name
    store.set('folders', folders)
    return folders
  })

  ipcMain.handle('folders:remove', (_e, id: string) => {
    unwatchFolder(id)
    const all = persistedFolders()
    const removedParentId = all.find((f) => f.id === id)?.parentId ?? null
    // Promote children up one level rather than orphaning or cascade-deleting them.
    const folders = all
      .filter((f) => f.id !== id)
      .map((f) => (f.parentId === id ? { ...f, parentId: removedParentId } : f))
    store.set('folders', folders)
    const sounds = persistedSounds().map((s) =>
      s.folderId === id ? { ...s, folderId: removedParentId } : s
    )
    store.set('sounds', sounds)
    return { sounds, folders }
  })

  ipcMain.handle('sounds:setFolder', (_e, id: string, folderId: string | null) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) target.folderId = folderId
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:remove', async (_e, id: string) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) {
      await fs.unlink(target.filePath).catch(() => {})
      if (target.imagePath) await fs.unlink(target.imagePath).catch(() => {})
    }
    const updated = sounds.filter((s) => s.id !== id)
    store.set('sounds', updated)
    syncShortcuts()
    return updated
  })

  ipcMain.handle('sounds:setVolume', (_e, id: string, volume: number) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) target.volume = volume
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:trim', async (_e, id: string, bytes: Uint8Array) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (!target) return sounds

    const newPath = join(getSoundsDir(), `${randomUUID()}.wav`)
    await fs.writeFile(newPath, bytes)

    const oldPath = target.filePath
    target.filePath = newPath
    target.ext = 'wav'
    store.set('sounds', sounds)

    await fs.unlink(oldPath).catch(() => {})
    return sounds
  })

  ipcMain.handle('sounds:rename', (_e, id: string, name: string) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) target.name = name.trim() || target.name
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:setEmoji', async (_e, id: string, emoji: string | null) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) {
      if (target.imagePath) await fs.unlink(target.imagePath).catch(() => {})
      target.imagePath = null
      target.emoji = emoji
    }
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:pickImage', async (_e, id: string) => {
    if (!mainWindow) return persistedSounds()
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose an image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ALLOWED_IMAGE_EXTENSIONS }]
    })
    if (result.canceled || result.filePaths.length === 0) return persistedSounds()

    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (!target) return sounds

    const srcPath = result.filePaths[0]
    const ext = extname(srcPath).slice(1).toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return sounds

    if (target.imagePath) await fs.unlink(target.imagePath).catch(() => {})
    const destPath = join(getIconsDir(), `${randomUUID()}.${ext}`)
    await fs.copyFile(srcPath, destPath)

    target.imagePath = destPath
    target.emoji = null
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:clearIcon', async (_e, id: string) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (target) {
      if (target.imagePath) await fs.unlink(target.imagePath).catch(() => {})
      target.imagePath = null
      target.emoji = null
    }
    store.set('sounds', sounds)
    return sounds
  })

  ipcMain.handle('sounds:setKeybind', (_e, id: string, accelerator: string | null) => {
    const sounds = persistedSounds()
    const target = sounds.find((s) => s.id === id)
    if (!target) return { sounds, error: 'Sound not found' }

    if (accelerator === null) {
      target.keybind = null
      store.set('sounds', sounds)
      syncShortcuts()
      return { sounds }
    }

    const normalized = normalizeAccelerator(accelerator)
    const conflict = sounds.find(
      (s) => s.id !== id && s.keybind && normalizeAccelerator(s.keybind) === normalized
    )
    if (conflict) {
      return { sounds, error: `Already bound to "${conflict.name}"` }
    }

    const testOk = globalShortcut.register(accelerator, () => {})
    if (testOk) globalShortcut.unregister(accelerator)
    if (!testOk) {
      const error = globalShortcutsSupported
        ? "That combination couldn't be registered — it may already be used by another app."
        : "Global shortcuts aren't available in this desktop session (common on Wayland). Try the Stream Deck / command-line trigger instead."
      return { sounds, error }
    }

    target.keybind = accelerator
    store.set('sounds', sounds)
    syncShortcuts()
    return { sounds }
  })

  ipcMain.handle('sounds:readFile', async (_e, filePath: string) => {
    const soundsDir = getSoundsDir()
    if (!filePath.startsWith(soundsDir)) {
      throw new Error('Refusing to read file outside the soundboard library')
    }
    return fs.readFile(filePath)
  })

  ipcMain.handle('sounds:readIcon', async (_e, filePath: string) => {
    const iconsDir = getIconsDir()
    if (!filePath.startsWith(iconsDir)) {
      throw new Error('Refusing to read file outside the icon library')
    }
    return fs.readFile(filePath)
  })

  ipcMain.handle('app:getExecPath', () => getInvocationCommand())
  ipcMain.handle('app:getCapabilities', () => ({ globalShortcuts: globalShortcutsSupported }))
  ipcMain.handle('app:openSoundsFolder', () => shell.openPath(getSoundsDir()))
  ipcMain.handle('app:copyToClipboard', (_e, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('app:quit', () => {
    quitRequested = true
    app.quit()
  })
  ipcMain.handle('app:notifyReady', () => {
    flushPendingPlayRequests()
  })
}

let cleaningUpBeforeQuit = false
app.on('before-quit', (e) => {
  quitRequested = true
  if (cleaningUpBeforeQuit) return
  e.preventDefault()
  cleaningUpBeforeQuit = true
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  for (const id of [...folderWatchers.keys()]) unwatchFolder(id)
})

/** A launch whose only purpose is to play a sound in the (possibly not-yet-running) app -
 *  e.g. a Stream Deck button - shouldn't pop the GUI window up over whatever the user is
 *  doing. A bare launch (no flags) still opens normally. */
function hasPlayFlag(argv: string[]): boolean {
  return argv.some((a) => a.startsWith('--play='))
}

app.whenReady().then(async () => {
  if (process.argv.includes('--list-sounds')) {
    printSoundListAndExit()
    return
  }

  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_e, argv) => {
    handleCliArgs(argv)
    if (!hasPlayFlag(argv)) showMainWindow()
  })

  store = new Store<Settings>({ defaults: DEFAULT_SETTINGS })
  migrateSounds()

  await fs.mkdir(getSoundsDir(), { recursive: true })
  await fs.mkdir(getIconsDir(), { recursive: true })
  await audio.cleanupStaleModules().catch(() => {})
  await syncAllFolders()
  watchAllFolders()

  // The app requests mic access purely so navigator.mediaDevices.enumerateDevices()
  // returns real device labels (needed to match a device against the virtual sink
  // we create) - it never actually records audio from it.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  registerIpcHandlers()
  createWindow(hasPlayFlag(process.argv))
  createTray()
  probeGlobalShortcutSupport()
  syncShortcuts()
  handleCliArgs(process.argv)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(false)
    else showMainWindow()
  })
})

// Tray-resident: no windows open just means the user closed/hid the window, not that they
// want to quit. Quitting only happens via the explicit tray icon / Settings Quit action.
app.on('window-all-closed', () => {})
