const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')

const DEFAULT_SETTINGS = {
  engine: 'whisper',
  hotkey: 'RightCtrl',
  language: 'en',
  cleanup: true,
  spokenPunctuation: true,
  autoCapitalize: true,
  insertion: 'paste',
  launchAtLogin: false,
}

function freshState() {
  return {
    version: app.getVersion(),
    platform: process.platform,
    settings: { ...DEFAULT_SETTINGS },
    dictionary: [],
    snippets: [],
    history: [],
  }
}

function wordsIn(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'hush-state.json')
    this.state = this.load()
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      const base = freshState()
      return {
        ...base,
        ...parsed,
        version: base.version,
        platform: base.platform,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        dictionary: Array.isArray(parsed.dictionary) ? parsed.dictionary.slice(0, 100) : [],
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets.slice(0, 200) : [],
        history: Array.isArray(parsed.history)
          ? parsed.history.slice(0, 500).map((entry) => ({
              ...entry,
              words: Number.isFinite(entry.words) ? entry.words : wordsIn(entry.text),
            }))
          : [],
      }
    } catch {
      return freshState()
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2), 'utf8')
    } catch (error) {
      console.error('[hush] could not save state', error)
    }
  }

  get() {
    return this.state
  }

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch }
    this.save()
    return this.state
  }

  setDictionary(words) {
    this.state.dictionary = [...new Set(words.map((word) => String(word).trim()).filter(Boolean))].slice(0, 100)
    this.save()
    return this.state
  }

  setSnippets(snippets) {
    this.state.snippets = snippets.slice(0, 200)
    this.save()
    return this.state
  }

  addHistory(entry) {
    this.state.history.unshift({
      id: entry.id || `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: entry.text,
      createdAt: entry.createdAt || Date.now(),
      durationMs: entry.durationMs || 0,
      language: entry.language || undefined,
      words: wordsIn(entry.text),
    })
    this.state.history = this.state.history.slice(0, 500)
    this.save()
    return this.state.history[0]
  }

  deleteHistory(id) {
    this.state.history = this.state.history.filter((entry) => entry.id !== id)
    this.save()
    return this.state
  }

  clearHistory() {
    this.state.history = []
    this.save()
    return this.state
  }
}

module.exports = { Store, DEFAULT_SETTINGS, wordsIn }
