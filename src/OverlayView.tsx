import { useCallback, useEffect, useRef, useState } from 'react'
import { RibbonMark } from './components/RibbonMark'
import { Waveform } from './components/Waveform'
import { DEFAULT_SETTINGS } from './lib/defaults'
import { formatTranscript } from './lib/format'
import { HushRecorder } from './lib/recorder'
import type { ModelStatus, Phase, Settings, Snippet } from './lib/types'

const electronRuntime =
  typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
const isDesktop = Boolean(window.hush) || electronRuntime
const demoMode = !isDesktop && new URLSearchParams(window.location.search).has('demo')

const STATUS: Record<Phase, string> = {
  idle: 'READY',
  loading: 'PREPARING',
  listening: 'LISTENING',
  thinking: 'TRANSCRIBING',
  done: 'INSERTED',
  empty: 'NOTHING HEARD',
  error: 'PROBLEM',
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone blocked. Allow it in Windows Privacy settings.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone found.'
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'Something interrupted the recording. Try once more.'
}

export function Overlay() {
  const [phase, setPhase] = useState<Phase>(demoMode ? 'listening' : 'idle')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('')
  const [model, setModel] = useState<ModelStatus>({ status: 'idle', progress: 0 })

  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS)
  const snippetsRef = useRef<Snippet[]>([])
  const dictionaryRef = useRef<string[]>([])
  const runId = useRef(0)
  const finishRef = useRef<() => void>(() => {})
  const recorderRef = useRef<HushRecorder | null>(null)

  if (!recorderRef.current) {
    recorderRef.current = new HushRecorder({
      onPhase: (next) => setPhase(next),
      onModel: (status) => {
        setModel(status)
        void window.hush?.reportModel(status)
      },
      onAutoStop: () => finishRef.current(),
    })
  }

  const begin = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.isRecording) return
    const id = ++runId.current
    setFinalText('')
    setError('')
    setLanguage('')
    try {
      await recorder.start(settingsRef.current, dictionaryRef.current)
      if (id === runId.current) setPhase('listening')
    } catch (cause) {
      const message = friendlyError(cause)
      setError(message)
      setPhase('error')
      await window.hush?.reportError(message)
    }
  }, [])

  const finish = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    const id = ++runId.current
    try {
      const recording = await recorder.stop()
      if (id !== runId.current) return
      if (!recording) {
        setFinalText('')
        setPhase('empty')
        await window.hush?.reportEmpty(0)
        return
      }

      const settings = settingsRef.current
      const useWhisper =
        settings.engine === 'whisper' &&
        (settings.language === 'en' || settings.language === 'auto') &&
        Boolean(window.hush)

      let transcription: { text: string; language?: string; durationInSeconds: number }
      if (useWhisper) {
        transcription = await window.hush!.transcribe(recording.samples, {
          language: settings.language,
          keywords: dictionaryRef.current,
          durationInSeconds: recording.durationInSeconds,
        })
      } else {
        const result = await recorder.transcribe(recording.samples, settings, dictionaryRef.current)
        transcription = {
          text: result.text,
          language: result.language || undefined,
          durationInSeconds: result.durationInSeconds,
        }
      }
      if (id !== runId.current) return

      if (!transcription.text.trim()) {
        setFinalText('')
        setPhase('empty')
        await window.hush?.reportEmpty(transcription.durationInSeconds * 1000)
        return
      }
      const text = formatTranscript(transcription.text, settings, snippetsRef.current)
      if (!text) {
        setPhase('empty')
        await window.hush?.reportEmpty(transcription.durationInSeconds * 1000)
        return
      }
      setFinalText(text)
      setLanguage(transcription.language || '')
      setPhase('done')
      const response = await window.hush?.reportFinal({
        text,
        raw: transcription.text,
        durationMs: transcription.durationInSeconds * 1000,
        language: transcription.language,
      })
      if (response && !response.ok) {
        setError(response.error || 'The text is on your clipboard.')
        setPhase('error')
      }
    } catch (cause) {
      if (id !== runId.current) return
      const message = friendlyError(cause)
      setError(message)
      setPhase('error')
      await window.hush?.reportError(message)
    }
  }, [])

  finishRef.current = () => {
    void finish()
  }

  const cancel = useCallback(() => {
    runId.current++
    recorderRef.current?.cancel()
    setPhase('idle')
    setFinalText('')
    setError('')
  }, [])

  const getWaveform = useCallback(() => recorderRef.current?.getWaveform() ?? null, [])

  useEffect(() => {
    const bridge = window.hush
    if (!bridge) {
      if (isDesktop) console.error('[hush] preload bridge missing; overlay is inert')
      return
    }
    let alive = true
    const recorder = recorderRef.current

    const applyState = (state: Awaited<ReturnType<typeof bridge.getState>>) => {
      settingsRef.current = state.settings
      snippetsRef.current = state.snippets
      dictionaryRef.current = state.dictionary
      if (state.settings.language !== 'auto') setLanguage(state.settings.language)

      if (state.settings.engine === 'whistle') {
        void recorder?.preload().catch((cause) => {
          if (!alive) return
          const message = friendlyError(cause)
          setError(message)
          void bridge.reportModel({ status: 'error', progress: 0, detail: message })
        })
      } else {
        void bridge.getModels().then((models) => {
          if (!alive) return
          if (models.whisper.installed) {
            setModel({ status: 'ready', progress: 100 })
            void bridge.reportModel({ status: 'ready', progress: 100 })
          } else {
            const detail = 'Whisper model not installed'
            setModel({ status: 'idle', progress: 0, detail })
            void bridge.reportModel({ status: 'idle', progress: 0, detail })
          }
        })
      }
    }

    void bridge.getState().then((state) => {
      if (alive) applyState(state)
    })
    const offState = bridge.onStateChanged(applyState)
    const offStart = bridge.onPttStart(() => {
      void begin()
    })
    const offStop = bridge.onPttStop(() => {
      void finish()
    })
    const offCancel = bridge.onPttCancel(cancel)
    const offDownload = bridge.onModelDownload((event) => {
      if (event.engine !== 'whisper') return
      if (event.status === 'downloading') {
        setPhase('loading')
        setModel({
          status: 'loading',
          progress: event.progress,
          detail: event.detail || 'Downloading Whisper',
        })
      } else if (event.status === 'ready') {
        setModel({ status: 'ready', progress: 100 })
        setPhase((current) => (current === 'loading' ? 'thinking' : current))
      } else {
        setError(event.detail || 'Model download failed')
        setPhase('error')
      }
    })

    return () => {
      alive = false
      offState()
      offStart()
      offStop()
      offCancel()
      offDownload()
      void recorder?.dispose()
    }
  }, [begin, finish, cancel])

  useEffect(() => {
    if (!demoMode) return
    let cancelled = false
    const words =
      'The ribbon should feel like a thin line of light, not another floating card.'
    const run = async () => {
      while (!cancelled) {
        setPhase('listening')
        setFinalText('')
        await sleep(2300)
        if (cancelled) return
        setPhase('thinking')
        await sleep(1100)
        if (cancelled) return
        setFinalText(words)
        setPhase('done')
        await sleep(3200)
        if (cancelled) return
        setPhase('idle')
        setFinalText('')
        await sleep(900)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancel()
        void window.hush?.hideOverlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  const waveformMode =
    phase === 'listening'
      ? 'listening'
      : phase === 'thinking'
        ? 'thinking'
        : phase === 'done'
          ? 'done'
          : phase === 'error'
            ? 'error'
            : phase === 'empty'
              ? 'empty'
              : 'idle'

  if (isDesktop && phase === 'idle') return null

  const shown = finalText
  const languageLabel = (
    language ||
    (settingsRef.current.language === 'auto' ? '' : settingsRef.current.language) ||
    'auto'
  ).toUpperCase()

  const placeholder =
    phase === 'loading'
      ? `${model.detail || 'Preparing model'}${model.progress ? ` ${model.progress}%` : ''}`
      : phase === 'thinking'
        ? 'Transcribing…'
        : phase === 'empty'
          ? 'Didn’t catch that.'
          : phase === 'error'
            ? error
            : 'Listening…'

  return (
    <div className="overlay-stage" data-phase={phase}>
      <section className={`ribbon phase-${phase}`} aria-live="polite">
        <header className="ribbon-head">
          <div className="ribbon-brand">
            <RibbonMark size={14} />
            <span>HUSH</span>
          </div>
          <div className="ribbon-status">
            <span className="status-dot" />
            <span className="status-label">{STATUS[phase]}</span>
            {(phase === 'listening' || phase === 'done') && (
              <span className="status-lang">{languageLabel}</span>
            )}
          </div>
        </header>

        <div className={`ribbon-text ${shown ? 'has-text' : 'is-placeholder'}`}>
          <span>
            {shown || placeholder}
            {phase === 'listening' && <span className="caret" />}
          </span>
        </div>

        <div className="ribbon-wave">
          <Waveform mode={waveformMode} demo={demoMode} getData={getWaveform} />
        </div>
      </section>
    </div>
  )
}
