import { useCallback, useEffect, useRef, useState } from 'react'
import { FlowPage } from './components/FlowPage'
import { HistoryPage } from './components/HistoryPage'
import { DictionaryPage } from './components/DictionaryPage'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar } from './components/Sidebar'
import { SnippetsPage } from './components/SnippetsPage'
import { WindowBar } from './components/WindowBar'
import { RibbonMark } from './components/RibbonMark'
import { api } from './lib/api'
import type { AppState, ModelStatus, Page, Settings, Snippet } from './lib/types'

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [model, setModel] = useState<ModelStatus>({ status: 'idle', progress: 0 })
  const [page, setPage] = useState<Page>('flow')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    let alive = true
    void api.getState().then((next) => {
      if (alive) setState(next)
    })
    void api.getModelStatus().then((next) => {
      if (alive) setModel(next)
    })
    const offState = api.onStateChanged((next) => setState(next))
    const offModel = api.onModelStatus((next) => setModel(next))
    return () => {
      alive = false
      offState()
      offModel()
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await api.updateSettings(patch)
    setState(next)
  }, [])

  const saveDictionary = useCallback(async (words: string[]) => {
    const next = await api.setDictionary(words)
    setState(next)
  }, [])

  const saveSnippets = useCallback(async (snippets: Snippet[]) => {
    const next = await api.setSnippets(snippets)
    setState(next)
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    const next = await api.deleteHistory(id)
    setState(next)
  }, [])

  const clearHistory = useCallback(async () => {
    const next = await api.clearHistory()
    setState(next)
  }, [])

  if (!state) {
    return (
      <div className="app-shell">
        <WindowBar />
        <div className="boot-screen">
          <div className="boot-mark">
            <RibbonMark size={34} />
          </div>
          <div className="boot-title">hush.</div>
          <div className="boot-copy">Waking up the quiet part of your computer…</div>
          <div className="boot-line">
            <span />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <WindowBar />
      <div className="app-body">
        <Sidebar page={page} historyCount={state.history.length} onNavigate={setPage} />
        <main className="main-scroll">
          <div className="page-transition" key={page}>
            {page === 'flow' && (
              <FlowPage state={state} model={model} onNavigate={setPage} onToast={notify} />
            )}
            {page === 'history' && (
              <HistoryPage
                state={state}
                onDelete={deleteEntry}
                onClear={clearHistory}
                onToast={notify}
              />
            )}
            {page === 'dictionary' && (
              <DictionaryPage state={state} onSave={saveDictionary} onToast={notify} />
            )}
            {page === 'snippets' && (
              <SnippetsPage state={state} onSave={saveSnippets} onToast={notify} />
            )}
            {page === 'settings' && (
              <SettingsPage
                state={state}
                model={model}
                onSettings={updateSettings}
                onClearHistory={clearHistory}
                onToast={notify}
              />
            )}
          </div>
        </main>
      </div>

      <div className={`toast${toast ? ' is-visible' : ''}`} role="status">
        <span className="toast-dot" />
        {toast}
      </div>
    </div>
  )
}
