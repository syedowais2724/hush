import {
  AudioWaveform,
  Check,
  ClipboardPaste,
  Keyboard,
  Languages,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { HOTKEY_LABELS, LANGUAGE_LABELS } from '../lib/defaults'
import type { AppState, ModelDownloadEvent, ModelsState, ModelStatus, Settings } from '../lib/types'
import { Toggle } from './Toggle'

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

export function SettingsPage({
  state,
  model,
  onSettings,
  onClearHistory,
  onToast,
}: {
  state: AppState
  model: ModelStatus
  onSettings: (patch: Partial<Settings>) => Promise<void>
  onClearHistory: () => Promise<void>
  onToast: (message: string) => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [models, setModels] = useState<ModelsState | null>(null)
  const [download, setDownload] = useState<ModelDownloadEvent | null>(null)
  const { settings } = state
  const engineName = settings.engine === 'whisper' ? 'Whisper' : 'Whistle'
  const whisper = settings.engine === 'whisper'

  useEffect(() => {
    let alive = true
    void api.getModels().then((next) => {
      if (alive) setModels(next)
    })
    const off = api.onModelDownload((event) => {
      setDownload(event)
      if (event.status !== 'downloading') {
        void api.getModels().then((next) => {
          if (alive) setModels(next)
        })
      }
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  const downloadWhisper = async () => {
    try {
      await api.downloadModel('whisper')
      setModels(await api.getModels())
      onToast('Whisper model ready')
    } catch {
      onToast('Download failed. Check your connection.')
    }
  }

  const engineStatus =
    model.status === 'ready'
      ? `${engineName} ready`
      : model.status === 'loading'
        ? `${engineName} ${model.progress || 0}%`
        : model.status === 'error'
          ? model.detail || `${engineName} offline`
          : model.detail || `${engineName} idle`

  return (
    <div className="page settings-page">
      <header className="page-top">
        <div className="page-top-left">
          <span className="page-kicker">Settings</span>
          <span className="page-date">Version {state.version}</span>
        </div>
        <div className="page-top-right">
          <div className={`model-pill is-${model.status}`}>
            <span className="model-dot" />
            {engineStatus}
          </div>
        </div>
      </header>

      <section className="page-heading settings-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Make it yours
          </span>
          <h1>
            Quiet defaults. <span className="hero-italic">Sharp edges.</span>
          </h1>
          <p className="page-lede">
            Hush is designed to disappear. Tune the key, the language and how the words land —
            everything stays on this machine.
          </p>
        </div>
        <div className="settings-stamp">
          <ShieldCheck size={16} />
          <div>
            <strong>No account</strong>
            <span>No cloud sync</span>
          </div>
        </div>
      </section>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <AudioWaveform size={17} />
              </div>
              <div>
                <h2>Recognition engine</h2>
                <p>Accuracy or speed — both stay on this machine.</p>
              </div>
            </header>

            <div className="choice-grid engine-grid">
              <button
                type="button"
                className={`choice-card engine-choice${whisper ? ' is-selected' : ''}`}
                onClick={() => void onSettings({ engine: 'whisper' })}
              >
                <div className="engine-choice-head">
                  <strong>Whisper base</strong>
                  <span className="engine-badge">Recommended</span>
                </div>
                <span className="engine-meta">59 MB · English · most accurate</span>
                <span>OpenAI’s Whisper, quantized and running locally. About 2s for a sentence.</span>
                <span className="choice-radio">{whisper && <Check size={11} />}</span>
              </button>

              <button
                type="button"
                className={`choice-card engine-choice${!whisper ? ' is-selected' : ''}`}
                onClick={() => void onSettings({ engine: 'whistle' })}
              >
                <div className="engine-choice-head">
                  <strong>Whistle</strong>
                  <span className="engine-badge is-quiet">Fast</span>
                </div>
                <span className="engine-meta">16.9 MB · 7 languages · instant</span>
                <span>Cactus Compute’s tiny model. Lowest power, best for short bursts.</span>
                <span className="choice-radio">{!whisper && <Check size={11} />}</span>
              </button>
            </div>

            <p className="card-note">
              Whisper is English-only for now; other languages fall back to Whistle automatically.
              Switching engines never uploads audio.
            </p>
          </section>

          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <Keyboard size={17} />
              </div>
              <div>
                <h2>The voice key</h2>
                <p>Hold it anywhere. Release to write.</p>
              </div>
            </header>
            <div className="segmented">
              {(Object.keys(HOTKEY_LABELS) as Settings['hotkey'][]).map((key) => (
                <button
                  type="button"
                  key={key}
                  className={settings.hotkey === key ? 'is-selected' : ''}
                  onClick={() => void onSettings({ hotkey: key })}
                >
                  {settings.hotkey === key && <Check size={13} />}
                  {HOTKEY_LABELS[key]}
                </button>
              ))}
            </div>
            <p className="card-note">
              Single keys are safest. Right Ctrl never fires a Windows shortcut on its own. Right
              Alt can type special characters on international layouts.
            </p>
          </section>

          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <Languages size={17} />
              </div>
              <div>
                <h2>Language</h2>
                <p>
                  {whisper
                    ? 'Whisper is English-only. Other languages switch to Whistle automatically.'
                    : 'Whistle can identify the language, or stay pinned to one.'}
                </p>
              </div>
            </header>
            <div className="select-wrap">
              <select
                value={settings.language}
                onChange={(event) => void onSettings({ language: event.target.value as Settings['language'] })}
              >
                {(Object.keys(LANGUAGE_LABELS) as Settings['language'][]).map((key) => (
                  <option key={key} value={key}>
                    {LANGUAGE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <p className="card-note">Seven languages: English, German, French, Spanish, Italian, Dutch and Polish.</p>
          </section>

          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <Wand2 size={17} />
              </div>
              <div>
                <h2>Writing</h2>
                <p>Small rules applied after the model speaks.</p>
              </div>
            </header>

            <SettingRow
              title="Smart cleanup"
              description="Remove “um”, “uh” and accidental repeated words."
            >
              <Toggle
                checked={settings.cleanup}
                onChange={(next) => void onSettings({ cleanup: next })}
                label="Smart cleanup"
              />
            </SettingRow>

            <SettingRow
              title="Spoken punctuation"
              description="Say “comma”, “period” or “new paragraph” to write them."
            >
              <Toggle
                checked={settings.spokenPunctuation}
                onChange={(next) => void onSettings({ spokenPunctuation: next })}
                label="Spoken punctuation"
              />
            </SettingRow>

            <SettingRow
              title="Capitalize sentences"
              description="Start a sentence and the standalone “I” with a capital."
            >
              <Toggle
                checked={settings.autoCapitalize}
                onChange={(next) => void onSettings({ autoCapitalize: next })}
                label="Capitalize sentences"
              />
            </SettingRow>
          </section>

          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <ClipboardPaste size={17} />
              </div>
              <div>
                <h2>How text lands</h2>
                <p>Paste is fastest. Typing preserves your clipboard.</p>
              </div>
            </header>

            <div className="choice-grid">
              <button
                type="button"
                className={`choice-card${settings.insertion === 'paste' ? ' is-selected' : ''}`}
                onClick={() => void onSettings({ insertion: 'paste' })}
              >
                <ClipboardPaste size={18} />
                <strong>Paste</strong>
                <span>Instant, works almost everywhere. Restores your clipboard afterwards.</span>
                <span className="choice-radio">{settings.insertion === 'paste' && <Check size={11} />}</span>
              </button>
              <button
                type="button"
                className={`choice-card${settings.insertion === 'type' ? ' is-selected' : ''}`}
                onClick={() => void onSettings({ insertion: 'type' })}
              >
                <Type size={18} />
                <strong>Type it out</strong>
                <span>Keystroke by keystroke. Leaves the clipboard untouched.</span>
                <span className="choice-radio">{settings.insertion === 'type' && <Check size={11} />}</span>
              </button>
            </div>
          </section>

          <section className="settings-card">
            <header className="settings-section-head">
              <div className="settings-icon">
                <Sparkles size={17} />
              </div>
              <div>
                <h2>This machine</h2>
                <p>Startup and local data.</p>
              </div>
            </header>

            <SettingRow title="Start with Windows" description="Keep Hush ready in the tray.">
              <Toggle
                checked={settings.launchAtLogin}
                onChange={(next) => void onSettings({ launchAtLogin: next })}
                label="Start with Windows"
              />
            </SettingRow>

            <SettingRow title="Clear history" description="Remove every saved dictation from this machine.">
              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  await onClearHistory()
                  onToast('History cleared')
                }}
              >
                Clear
              </button>
            </SettingRow>

            <SettingRow title="Preferences" description="Return every writing rule to its default.">
              {confirmReset ? (
                <div className="confirm-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={async () => {
                      await onSettings({
                        engine: 'whisper',
                        hotkey: 'RightCtrl',
                        language: 'en',
                        cleanup: true,
                        spokenPunctuation: true,
                        autoCapitalize: true,
                        insertion: 'paste',
                        launchAtLogin: false,
                      })
                      setConfirmReset(false)
                      onToast('Preferences reset')
                    }}
                  >
                    Confirm
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="ghost-button" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </SettingRow>
          </section>
        </div>

        <aside className="settings-aside">
          <section className="model-card">
            <div className="model-card-top">
              <span className="card-kicker">The model</span>
              <span className={`model-state is-${model.status}`}>
                <span className="model-dot" />
                {model.status === 'ready' ? 'Ready' : model.status === 'loading' ? `${model.progress || 0}%` : model.status}
              </span>
            </div>
            <h2>{whisper ? 'Whisper base' : 'Whistle'}</h2>
            <p>
              {whisper
                ? 'OpenAI’s Whisper base.en, quantized to 59 MB and running locally through whisper.cpp. English-only, no GPU, no server.'
                : 'A 16.9 MB speech model that runs on the CPU. Seven languages, word timestamps and keyword bias — no GPU, no server.'}
            </p>
            <div className="model-stats">
              <div>
                <strong>{whisper ? '59 MB' : '16.9 MB'}</strong>
                <span>weights</span>
              </div>
              <div>
                <strong>{whisper ? '1' : '7'}</strong>
                <span>language{whisper ? '' : 's'}</span>
              </div>
              <div>
                <strong>0</strong>
                <span>uploads</span>
              </div>
            </div>
            {model.status === 'loading' && (
              <div className="model-progress">
                <span style={{ width: `${model.progress}%` }} />
              </div>
            )}
            <div className="model-legal">
              <ShieldCheck size={13} /> {whisper ? 'MIT · OpenAI / whisper.cpp' : 'Apache-2.0 · Cactus Compute'}
            </div>
          </section>

          <section className="models-card">
            <div className="models-card-top">
              <span className="card-kicker">Model files</span>
              <span className="models-offline">Offline</span>
            </div>
            <h2>Downloads</h2>
            <div className="model-file-row">
              <div>
                <strong>Whisper base.en</strong>
                <span>
                  {models
                    ? models.whisper.installed
                      ? models.whisper.bundled
                        ? 'Bundled with Hush'
                        : 'Downloaded'
                      : 'Not installed'
                    : 'Checking…'}
                </span>
              </div>
              {models?.whisper.installed ? (
                <span className="file-ready">
                  <Check size={13} /> Ready
                </span>
              ) : (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={download?.status === 'downloading'}
                  onClick={() => void downloadWhisper()}
                >
                  Download · 59 MB
                </button>
              )}
            </div>
            <div className="model-file-row">
              <div>
                <strong>Whistle</strong>
                <span>{models?.whistle.installed ? 'Bundled with Hush' : 'Downloads on first use'}</span>
              </div>
              <span className="file-ready">
                <Check size={13} /> Ready
              </span>
            </div>
            {download?.status === 'downloading' && (
              <div className="file-progress">
                <span style={{ width: `${download.progress}%` }} />
              </div>
            )}
            <p className="model-files-note">
              Download once, then every dictation works without a connection.
            </p>
          </section>

          <section className="tip-card">
            <span className="card-kicker">A good first run</span>
            <ol>
              <li>Click the test pad on Flow.</li>
              <li>Hold your voice key and say a sentence.</li>
              <li>Release. The words land at the cursor.</li>
            </ol>
            <p>If nothing appears, check Windows microphone privacy for desktop apps.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
