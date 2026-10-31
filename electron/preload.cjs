const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('hush', {
  getState: () => ipcRenderer.invoke('state:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  setDictionary: (words) => ipcRenderer.invoke('dictionary:set', words),
  setSnippets: (snippets) => ipcRenderer.invoke('snippets:set', snippets),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  transcribe: (samples, options) => ipcRenderer.invoke('stt:transcribe', { samples, ...options }),
  getModels: () => ipcRenderer.invoke('models:get'),
  downloadModel: (engine) => ipcRenderer.invoke('models:download', engine),
  reportFinal: (result) => ipcRenderer.invoke('stt:final', result),
  reportEmpty: (durationMs) => ipcRenderer.invoke('stt:empty', durationMs),
  reportError: (message) => ipcRenderer.invoke('stt:error', message),
  reportModel: (status) => ipcRenderer.invoke('model:report', status),
  getModelStatus: () => ipcRenderer.invoke('model:get'),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  openMain: () => ipcRenderer.invoke('app:open-main'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onPttStart: (callback) => subscribe('ptt:start', callback),
  onPttStop: (callback) => subscribe('ptt:stop', callback),
  onPttCancel: (callback) => subscribe('ptt:cancel', callback),
  onStateChanged: (callback) => subscribe('state:changed', callback),
  onModelStatus: (callback) => subscribe('model:status', callback),
  onModelDownload: (callback) => subscribe('models:progress', callback),
})
