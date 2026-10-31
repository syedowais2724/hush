const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  clipboard,
  nativeImage,
  protocol,
  session,
  shell,
} = require('electron')
const { Store } = require('./store.cjs')
const native = require('./native.cjs')
const { Hotkey } = require('./hotkey.cjs')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const devServer = (process.env.VITE_DEV_SERVER_URL || '').replace(/\/$/, '')
const isDevTools = Boolean(process.env.HUSH_DEVTOOLS)

app.setName('Hush')

if (isDev || process.env.HUSH_DEBUG) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hush',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

let store
let mainWindow = null
let overlayWindow = null
let tray = null
let hotkey = null
let isQuitting = false
let overlayReady = false
let dictationActive = false
let dictationBusy = false
let overlayShown = false
let showTimer = null
let busyTimer = null
let stopTimer = null
let lastTarget = 0
let hideTimer = null
let modelStatus = { status: 'idle', progress: 0 }

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function mimeType(file) {
  const ext = path.extname(file).toLowerCase()
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.wasm': 'application/wasm',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.ico': 'image/x-icon',
      '.map': 'application/json',
    }[ext] || 'application/octet-stream'
  )
}

function whisperRuntimeDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'whisper')
    : path.join(__dirname, '..', 'tools', 'whisper', 'runtime')
}

const WHISPER_MODEL_FILE = 'ggml-base.en-q5_1.bin'
const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin'
const WHISPER_MODEL_BYTES = 59_721_011

function userWhisperDir() {
  return path.join(app.getPath('userData'), 'models', 'whisper')
}

function bundledWhisperModel() {
  return path.join(whisperRuntimeDir(), WHISPER_MODEL_FILE)
}

function userWhisperModel() {
  return path.join(userWhisperDir(), WHISPER_MODEL_FILE)
}

function whisperModelPath() {
  const userModel = userWhisperModel()
  if (fs.existsSync(userModel) && fs.statSync(userModel).size > 50_000_000) return userModel
  const bundled = bundledWhisperModel()
  if (fs.existsSync(bundled)) return bundled
  return null
}

let whisperDownload = null

function broadcastModelDownload(event) {
  for (const window of [mainWindow, overlayWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('models:progress', event)
  }
  if (store && store.get().settings.engine === event.engine) {
    modelStatus =
      event.status === 'downloading'
        ? { status: 'loading', progress: event.progress, detail: event.detail || 'Downloading model' }
        : event.status === 'ready'
          ? { status: 'ready', progress: 100 }
          : { status: 'error', progress: 0, detail: event.detail || 'Model download failed' }
    broadcastModel()
  }
}

async function downloadWhisperModel() {
  const bundled = bundledWhisperModel()
  if (fs.existsSync(bundled)) return bundled
  if (whisperDownload) return whisperDownload

  whisperDownload = (async () => {
    const dir = userWhisperDir()
    await fs.promises.mkdir(dir, { recursive: true })
    const target = userWhisperModel()
    const temp = `${target}.part`

    broadcastModelDownload({
      engine: 'whisper',
      status: 'downloading',
      progress: 0,
      detail: 'Downloading Whisper',
    })

    const response = await fetch(WHISPER_MODEL_URL, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`Model download failed (${response.status})`)
    }
    const total = Number(response.headers.get('content-length')) || WHISPER_MODEL_BYTES
    const reader = response.body.getReader()
    const file = fs.createWriteStream(temp)
    let received = 0
    let lastReport = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        file.write(Buffer.from(value))
        received += value.length
        const now = Date.now()
        if (now - lastReport > 220) {
          lastReport = now
          broadcastModelDownload({
            engine: 'whisper',
            status: 'downloading',
            progress: Math.min(99, Math.round((received / total) * 100)),
            detail: 'Downloading Whisper',
          })
        }
      }
      await new Promise((resolve, reject) => {
        file.end(() => resolve())
        file.on('error', reject)
      })
      const stat = await fs.promises.stat(temp)
      if (stat.size < 50_000_000) throw new Error('Downloaded model is incomplete')
      await fs.promises.rename(temp, target)
      broadcastModelDownload({
        engine: 'whisper',
        status: 'ready',
        progress: 100,
        detail: 'Whisper ready',
      })
      return target
    } catch (error) {
      file.destroy()
      await fs.promises.unlink(temp).catch(() => {})
      broadcastModelDownload({
        engine: 'whisper',
        status: 'error',
        progress: 0,
        detail: error instanceof Error ? error.message : 'Download failed',
      })
      throw error
    }
  })()

  try {
    return await whisperDownload
  } finally {
    whisperDownload = null
  }
}

function writePcmWav(samples) {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(16000, 24)
  buffer.writeUInt32LE(32000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }
  return buffer
}

async function transcribeWithWhisper({ samples, language, keywords }) {
  const pcm = samples instanceof Float32Array ? samples : new Float32Array(samples)
  if (!pcm.length) return { text: '', language: 'en', durationInSeconds: 0 }

  const runtime = whisperRuntimeDir()
  const cli = path.join(runtime, 'whisper-cli.exe')
  if (!fs.existsSync(cli)) {
    throw new Error('The accurate engine is missing. Reinstall Hush or switch to Whistle.')
  }
  const model = whisperModelPath() || (await downloadWhisperModel())
  if (!fs.existsSync(model)) {
    throw new Error('The accurate model is missing. Switch to Whistle in Settings, or reinstall Hush.')
  }

  const dir = path.join(os.tmpdir(), 'hush-whisper')
  await fs.promises.mkdir(dir, { recursive: true })
  const stem = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const wavPath = `${stem}.wav`
  await fs.promises.writeFile(wavPath, writePcmWav(pcm))

  const threads = Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2)))
  const args = [
    '-m', model,
    '-f', wavPath,
    '-nt',
    '-np',
    '-oj',
    '-of', stem,
    '-t', String(threads),
    '-l', 'en',
  ]
  const prompt = (keywords || []).filter(Boolean).slice(0, 16).join(', ')
  if (prompt) args.push('--prompt', prompt)

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(cli, args, { cwd: runtime, windowsHide: true })
      let output = ''
      const timer = setTimeout(() => {
        output += '\n[whisper] timed out'
        try {
          child.kill()
        } catch {
          // ignore
        }
        reject(new Error('Whisper took too long. Try a shorter phrase.'))
      }, 60_000)

      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        output += chunk.toString()
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) {
          reject(new Error(`Whisper failed (${code}). ${output.slice(-300)}`))
        } else {
          resolve()
        }
      })
    })

    const payload = JSON.parse(await fs.promises.readFile(`${stem}.json`, 'utf8'))
    const text = (payload.transcription || [])
      .map((segment) => segment.text || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      text,
      language: payload.result?.language || 'en',
      durationInSeconds: pcm.length / 16000,
    }
  } finally {
    for (const file of [wavPath, `${stem}.json`]) {
      try {
        await fs.promises.unlink(file)
      } catch {
        // already gone
      }
    }
  }
}

function registerProtocol() {
  if (isDev) return
  protocol.handle('hush', async (request) => {
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)
    if (!pathname || pathname === '/') pathname = '/index.html'
    const root = path.join(__dirname, '..', 'dist')
    const target = path.normalize(path.join(root, pathname))
    if (!target.startsWith(root)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const data = await fs.promises.readFile(target)
      return new Response(data, {
        status: 200,
        headers: { 'content-type': mimeType(target) },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function rendererUrl(page) {
  return isDev ? `${devServer}/${page}` : `hush://app/${page}`
}

function openDevTools(window) {
  if (!isDevTools) return
  window.webContents.openDevTools({ mode: 'detach', activate: true })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 870,
    minWidth: 1020,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#e7ebe5',
    title: 'Hush',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadURL(rendererUrl('index.html'))
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    openDevTools(mainWindow)
  })
  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
}

function createOverlayWindow() {
  const width = 460
  const height = 110
  const display = screen.getPrimaryDisplay()
  const area = display.workArea

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + area.height - height - 8),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.loadURL(rendererUrl('overlay.html'))
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayReady = true
  })
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  overlayWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  overlayWindow.on('closed', () => {
    overlayWindow = null
    overlayReady = false
  })
  openDevTools(overlayWindow)
}

function placeOverlay() {
  if (!overlayWindow) return
  const [width, height] = overlayWindow.getSize()
  const point = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(point)
  overlayWindow.setBounds({
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + workArea.height - height - 10),
    width,
    height,
  })
}

function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  placeOverlay()
  overlayWindow.showInactive()
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
}

function hideOverlay() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
  overlayShown = false
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
}

function scheduleHide(ms) {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = null
    hideOverlay()
  }, ms)
}

function clearStopTimer() {
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
}

function sendToOverlay(channel, payload) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, payload)
  }
}

function broadcastState() {
  const state = store.get()
  for (const window of [mainWindow, overlayWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('state:changed', state)
  }
}

function broadcastModel() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('model:status', modelStatus)
  }
}

function beginDictation() {
  if (dictationBusy || !overlayReady) return
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
  dictationBusy = true
  dictationActive = true
  lastTarget = native.foreground()
  const alreadyVisible = Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible())
  overlayShown = alreadyVisible

  console.log(`[hush] dictation begin · target=${lastTarget} · visible=${alreadyVisible}`)
  sendToOverlay('ptt:start')

  if (!alreadyVisible) {
    showTimer = setTimeout(() => {
      showTimer = null
      if (!dictationActive) return
      overlayShown = true
      showOverlay()
    }, 140)
  }

  if (busyTimer) clearTimeout(busyTimer)
  busyTimer = setTimeout(() => {
    busyTimer = null
    if (!dictationBusy) return
    console.warn('[hush] dictation exceeded 60s; closing')
    cancelDictation()
  }, 60_000)
}

function endDictation() {
  if (!dictationActive) return
  dictationActive = false
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }

  if (!overlayShown) {
    // A quick tap of the voice key should never flash the widget or transcribe.
    dictationBusy = false
    if (busyTimer) {
      clearTimeout(busyTimer)
      busyTimer = null
    }
    sendToOverlay('ptt:cancel')
    hideOverlay()
    return
  }

  console.log('[hush] dictation end')
  sendToOverlay('ptt:stop')

  if (busyTimer) {
    clearTimeout(busyTimer)
    busyTimer = null
  }
  if (stopTimer) clearTimeout(stopTimer)
  const downloadingWhisper =
    store.get().settings.engine === 'whisper' && !whisperModelPath()
  stopTimer = setTimeout(() => {
    stopTimer = null
    if (!dictationBusy) return
    console.warn('[hush] transcription timed out; closing the overlay')
    cancelDictation()
  }, downloadingWhisper ? 180_000 : 30_000)
}

function cancelDictation() {
  if (!dictationActive && !dictationBusy) return
  dictationActive = false
  dictationBusy = false
  overlayShown = false
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (busyTimer) {
    clearTimeout(busyTimer)
    busyTimer = null
  }
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
  hotkey?.release()
  sendToOverlay('ptt:cancel')
  scheduleHide(120)
}

async function restoreClipboard(previousText) {
  try {
    if (previousText) {
      await clipboard.writeText(previousText)
    } else {
      clipboard.clear()
    }
  } catch (error) {
    console.warn('[hush] clipboard restore failed', error)
  }
}

async function insertText(text, mode, target) {
  if (target && native.foreground() !== target) {
    native.focus(target)
    await sleep(70)
  }

  if (mode === 'type') {
    native.typeText(text)
    return
  }

  const previousText = await clipboard.readText().catch(() => '')
  await clipboard.writeText(text)
  await sleep(45)
  native.paste()
  await sleep(500)
  await restoreClipboard(previousText)
}

function applyLoginItem(settings) {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(settings.launchAtLogin),
      path: process.execPath,
      args: [],
    })
  } catch (error) {
    console.warn('[hush] could not update login item', error)
  }
}

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function quitApp() {
  isQuitting = true
  app.quit()
}

function registerIpc() {
  ipcMain.handle('state:get', () => store.get())

  ipcMain.handle('settings:update', (event, patch) => {
    if (patch && typeof patch === 'object' && dictationBusy) cancelDictation()
    const next = store.updateSettings(patch || {})
    applyLoginItem(next.settings)
    broadcastState()
    return next
  })

  ipcMain.handle('dictionary:set', (event, words) => {
    const next = store.setDictionary(Array.isArray(words) ? words : [])
    broadcastState()
    return next
  })

  ipcMain.handle('snippets:set', (event, snippets) => {
    const next = store.setSnippets(Array.isArray(snippets) ? snippets : [])
    broadcastState()
    return next
  })

  ipcMain.handle('history:delete', (event, id) => {
    const next = store.deleteHistory(id)
    broadcastState()
    return next
  })

  ipcMain.handle('history:clear', () => {
    const next = store.clearHistory()
    broadcastState()
    return next
  })

  ipcMain.handle('clipboard:write', async (event, text) => {
    await clipboard.writeText(String(text ?? ''))
  })

  ipcMain.handle('stt:transcribe', async (event, request) => {
    const started = Date.now()
    const result = await transcribeWithWhisper(request || {})
    console.log(
      `[hush] whisper ${Date.now() - started}ms · ${result.text.length} chars`,
    )
    return result
  })

  ipcMain.handle('models:get', () => {
    const bundled = bundledWhisperModel()
    const whisper = whisperModelPath()
    const whistleBundled = path.join(__dirname, '..', 'dist', 'models', 'whistle.cact')
    return {
      whisper: {
        installed: Boolean(whisper),
        bundled: fs.existsSync(bundled),
        bytes: WHISPER_MODEL_BYTES,
      },
      whistle: {
        installed: fs.existsSync(whistleBundled),
        bundled: fs.existsSync(whistleBundled),
        bytes: 16_919_407,
      },
    }
  })

  ipcMain.handle('models:download', async (event, engine) => {
    if (engine === 'whisper') {
      await downloadWhisperModel()
      return
    }
    sendToOverlay('models:warm-whistle')
  })

  ipcMain.handle('stt:final', async (event, result) => {
    clearStopTimer()
    const text = String(result?.text ?? '').trim()
    if (!text) {
      dictationBusy = false
      scheduleHide(900)
      return { ok: false, error: 'No text to insert.' }
    }

    if (isDev) console.log(`[hush] transcript: ${text}`)

    const settings = store.get().settings
    try {
      console.log(
        `[hush] inserting ${text.length} chars · target=${lastTarget} · foreground=${native.foreground()} · mode=${settings.insertion}`,
      )
      await insertText(text, settings.insertion, lastTarget)
      console.log('[hush] paste dispatched')
    } catch (error) {
      console.error('[hush] insertion failed', error)
      await clipboard.writeText(text)
      dictationBusy = false
      scheduleHide(3200)
      return {
        ok: false,
        error: 'Could not insert into that window. The text is on your clipboard.',
      }
    }

    store.addHistory({
      text,
      durationMs: Number(result?.durationMs) || 0,
      language: result?.language || undefined,
    })
    dictationBusy = false
    broadcastState()
    scheduleHide(1200)
    return { ok: true }
  })

  ipcMain.handle('stt:empty', () => {
    clearStopTimer()
    dictationBusy = false
    scheduleHide(1000)
  })

  ipcMain.handle('stt:error', () => {
    clearStopTimer()
    dictationBusy = false
    scheduleHide(3200)
  })

  ipcMain.handle('model:report', (event, status) => {
    modelStatus = status || { status: 'idle', progress: 0 }
    broadcastModel()
  })

  ipcMain.handle('model:get', () => modelStatus)

  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.hide()
  })

  ipcMain.handle('app:open-main', () => showMain())

  ipcMain.handle('app:quit', () => quitApp())
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Hush — hold Right Ctrl to dictate')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Hush', click: () => showMain() },
      { type: 'separator' },
      { label: 'Quit Hush', click: () => quitApp() },
    ]),
  )
  tray.on('click', () => showMain())
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media'
  })
}

app.whenReady().then(() => {
  registerProtocol()
  configurePermissions()
  store = new Store()
  modelStatus = { status: 'idle', progress: 0 }
  registerIpc()
  createMainWindow()
  createOverlayWindow()
  createTray()
  applyLoginItem(store.get().settings)

  hotkey = new Hotkey({
    getKey: () => store.get().settings.hotkey,
    onStart: () => beginDictation(),
    onStop: () => endDictation(),
    onCancel: () => cancelDictation(),
  })
  try {
    hotkey.start()
  } catch (error) {
    console.error('[hush] global hotkey failed to start', error)
  }

  app.on('activate', () => showMain())
})

app.on('window-all-closed', () => {
  // Hush lives in the tray.
})

app.on('before-quit', () => {
  isQuitting = true
  hotkey?.stop()
  tray?.destroy()
  tray = null
})
