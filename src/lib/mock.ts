import type { AppState, HistoryEntry, HushBridge } from './types'

const KEY = 'hush.mock.v1'

const now = Date.now()
const mins = (n: number) => n * 60_000

function entry(text: string, ago: number, durationMs: number, language = 'en'): HistoryEntry {
  return {
    id: `mock-${ago}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    createdAt: now - ago,
    durationMs,
    language,
    words: text.trim().split(/\s+/).filter(Boolean).length,
  }
}

const seed: AppState = {
  version: '0.1.0',
  platform: 'windows',
  settings: {
    engine: 'whisper',
    hotkey: 'RightCtrl',
    language: 'en',
    cleanup: true,
    spokenPunctuation: true,
    autoCapitalize: true,
    insertion: 'paste',
    launchAtLogin: false,
  },
  dictionary: ['Hush', 'Whistle', 'Cactus Compute', 'Syed Owais', 'ribbon UI', 'Wispr Flow'],
  snippets: [
    {
      id: 'snip-1',
      trigger: 'my address',
      expansion: 'Flat 4, 22 Marlowe Street, London',
    },
    {
      id: 'snip-2',
      trigger: 'intro email',
      expansion: 'Hey — quick note before I forget.',
    },
    {
      id: 'snip-3',
      trigger: 'sign off',
      expansion: 'Best,\nSyed',
    },
    {
      id: 'snip-4',
      trigger: 'meeting link',
      expansion: 'https://meet.google.com/hush-demo',
    },
  ],
  history: [
    entry(
      "Let's move the launch to Thursday and keep the onboarding flow exactly as it is.",
      mins(3),
      7400,
    ),
    entry(
      "Hey Maya — thanks for the quick turnaround. I'll send the revised deck before lunch tomorrow.",
      mins(36),
      11200,
    ),
    entry(
      'The new ribbon should feel like a thin line of light, not another floating card.',
      mins(74),
      8600,
    ),
    entry(
      'Remind me to book the studio for the 14th, and add a note to bring the microphone stands.',
      mins(188),
      12400,
    ),
    entry(
      'Take the second paragraph, make it warmer, and cut it by half.',
      mins(60 * 26),
      6100,
    ),
    entry('Hush is private by default. Audio never leaves the device.', mins(60 * 27), 5400),
    entry(
      'The quick brown fox jumps over the lazy dog, and the dog does not seem to mind at all.',
      mins(60 * 30),
      8900,
    ),
    entry(
      'Add a subtle grain to the paper background and keep the coral for the signal only.',
      mins(60 * 49),
      7800,
    ),
  ],
}

function clone(value: AppState): AppState {
  return JSON.parse(JSON.stringify(value)) as AppState
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    // ignore and reseed
  }
  localStorage.setItem(KEY, JSON.stringify(seed))
  return clone(seed)
}

let state = load()
const listeners = new Set<(state: AppState) => void>()

function commit(next: AppState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore quota
  }
  for (const listener of listeners) listener(clone(state))
}

function findById<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id)
}

export const mockApi: HushBridge = {
  async getState() {
    return clone(state)
  },
  async updateSettings(patch) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
    return clone(state)
  },
  async setDictionary(words) {
    commit({ ...state, dictionary: words })
    return clone(state)
  },
  async setSnippets(snippets) {
    commit({ ...state, snippets })
    return clone(state)
  },
  async deleteHistory(id) {
    commit({ ...state, history: state.history.filter((item) => item.id !== id) })
    return clone(state)
  },
  async clearHistory() {
    commit({ ...state, history: [] })
    return clone(state)
  },
  async copyText(text) {
    await navigator.clipboard?.writeText(text)
  },
  async transcribe(_samples, options) {
    await new Promise((resolve) => setTimeout(resolve, 700))
    return {
      text: 'This is a preview transcription from the Hush interface.',
      language: 'en',
      durationInSeconds: options.durationInSeconds,
    }
  },
  async getModels() {
    return {
      whisper: { installed: true, bundled: true, bytes: 59_721_011 },
      whistle: { installed: true, bundled: true, bytes: 16_919_407 },
    }
  },
  async downloadModel() {},
  onModelDownload() {
    return () => {}
  },
  reportFinal: async (result) => {
    const newEntry: HistoryEntry = {
      id: `live-${Date.now()}`,
      text: result.text,
      createdAt: Date.now(),
      durationMs: result.durationMs,
      language: result.language,
      words: result.text.trim().split(/\s+/).filter(Boolean).length,
    }
    commit({ ...state, history: [newEntry, ...state.history] })
    return { ok: true }
  },
  async reportEmpty() {},
  async reportError() {},
  async reportModel() {},
  async getModelStatus() {
    return { status: 'ready', progress: 100 }
  },
  async hideOverlay() {},
  async minimize() {},
  async maximize() {},
  async close() {},
  async openMain() {},
  async quit() {},
  onPttStart() {
    return () => {}
  },
  onPttStop() {
    return () => {}
  },
  onPttCancel() {
    return () => {}
  },
  onStateChanged(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  onModelStatus() {
    return () => {}
  },
}

export function resetMockState() {
  localStorage.removeItem(KEY)
  state = load()
  for (const listener of listeners) listener(clone(state))
}

export { findById }
