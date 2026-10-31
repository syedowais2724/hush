export type Page = 'flow' | 'history' | 'dictionary' | 'snippets' | 'settings'

export type Phase = 'idle' | 'loading' | 'listening' | 'thinking' | 'done' | 'empty' | 'error'

export interface Settings {
  engine: 'whisper' | 'whistle'
  hotkey: 'RightCtrl' | 'RightAlt' | 'F8' | 'F9'
  language: 'auto' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'pl'
  cleanup: boolean
  spokenPunctuation: boolean
  autoCapitalize: boolean
  insertion: 'paste' | 'type'
  launchAtLogin: boolean
}

export interface HistoryEntry {
  id: string
  text: string
  createdAt: number
  durationMs: number
  language?: string
  words: number
}

export interface Snippet {
  id: string
  trigger: string
  expansion: string
}

export interface AppState {
  settings: Settings
  history: HistoryEntry[]
  dictionary: string[]
  snippets: Snippet[]
  version: string
  platform: string
}

export interface FinalResult {
  text: string
  raw: string
  durationMs: number
  language?: string
}

export interface ModelStatus {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  detail?: string
}

export interface TranscriptionResponse {
  text: string
  language?: string
  durationInSeconds: number
}

export interface ModelFileInfo {
  installed: boolean
  bundled: boolean
  bytes: number
}

export interface ModelsState {
  whisper: ModelFileInfo
  whistle: ModelFileInfo
}

export interface ModelDownloadEvent {
  engine: 'whisper' | 'whistle'
  status: 'downloading' | 'ready' | 'error'
  progress: number
  detail?: string
}

export interface HushBridge {
  getState(): Promise<AppState>
  updateSettings(patch: Partial<Settings>): Promise<AppState>
  setDictionary(words: string[]): Promise<AppState>
  setSnippets(snippets: Snippet[]): Promise<AppState>
  deleteHistory(id: string): Promise<AppState>
  clearHistory(): Promise<AppState>
  copyText(text: string): Promise<void>
  transcribe(
    samples: Float32Array,
    options: { language: string; keywords: string[]; durationInSeconds: number },
  ): Promise<TranscriptionResponse>
  getModels(): Promise<ModelsState>
  downloadModel(engine: 'whisper' | 'whistle'): Promise<void>
  reportFinal(result: FinalResult): Promise<{ ok: boolean; error?: string }>
  reportEmpty(durationMs: number): Promise<void>
  reportError(message: string): Promise<void>
  reportModel(status: ModelStatus): Promise<void>
  getModelStatus(): Promise<ModelStatus>
  hideOverlay(): Promise<void>
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  openMain(): Promise<void>
  quit(): Promise<void>
  onPttStart(cb: () => void): () => void
  onPttStop(cb: () => void): () => void
  onPttCancel(cb: () => void): () => void
  onStateChanged(cb: (state: AppState) => void): () => void
  onModelStatus(cb: (status: ModelStatus) => void): () => void
  onModelDownload(cb: (event: ModelDownloadEvent) => void): () => void
}

declare global {
  interface Window {
    hush?: HushBridge
  }
}
