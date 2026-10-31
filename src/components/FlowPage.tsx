import { ArrowUpRight, BookOpen, Clock3, Mic, Sparkles, Zap } from 'lucide-react'
import type { AppState, ModelStatus, Page } from '../lib/types'
import { HOTKEY_LABELS } from '../lib/defaults'
import { clockTime, relativeTime, wordCount } from '../lib/format'
import { CopyButton } from './CopyButton'
import { Keycap } from './Keycap'
import { Sparkline } from './Sparkline'
import { Waveform } from './Waveform'

function todayStats(state: AppState) {
  const today = new Date()
  const entries = state.history.filter((entry) => {
    const date = new Date(entry.createdAt)
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  })
  return {
    entries,
    words: entries.reduce((sum, entry) => sum + entry.words, 0),
  }
}

function weekSeries(state: AppState) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return state.history
      .filter((entry) => {
        const created = new Date(entry.createdAt)
        return (
          created.getFullYear() === date.getFullYear() &&
          created.getMonth() === date.getMonth() &&
          created.getDate() === date.getDate()
        )
      })
      .reduce((sum, entry) => sum + entry.words, 0)
  })
}

function modelLabel(model: ModelStatus, engine: 'whisper' | 'whistle') {
  const name = engine === 'whisper' ? 'Whisper' : 'Whistle'
  if (model.status === 'ready') return `${name} ready`
  if (model.status === 'loading') return `${name} ${model.progress || 0}%`
  if (model.status === 'error') return model.detail || `${name} offline`
  if (model.detail) return model.detail
  return `${name} idle`
}

export function FlowPage({
  state,
  model,
  onNavigate,
  onToast,
}: {
  state: AppState
  model: ModelStatus
  onNavigate: (page: Page) => void
  onToast: (message: string) => void
}) {
  const stats = todayStats(state)
  const totalWords = state.history.reduce((sum, entry) => sum + entry.words, 0)
  const minutesSaved = Math.round(totalWords / 40)
  const hotkey = HOTKEY_LABELS[state.settings.hotkey]
  const recent = state.history.slice(0, 4)
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="page flow-page">
      <header className="page-top">
        <div className="page-top-left">
          <span className="page-kicker">Your workspace</span>
          <span className="page-date">{date}</span>
        </div>
        <div className="page-top-right">
          <div className={`model-pill is-${model.status}`}>
            <span className="model-dot" />
            {modelLabel(model, state.settings.engine)}
          </div>
          <div className="avatar" title="Local profile">
            S
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          On-device dictation · {state.settings.engine === 'whisper' ? 'Whisper 59 MB' : 'Whistle 16.9 MB'}
        </div>
        <h1 className="hero-title">
          Say it once.
          <span className="hero-italic">It’s already there.</span>
        </h1>
        <p className="hero-lede">
          Hold a key, speak like you think, release. Hush puts the words exactly where your
          cursor is — fast, private, and entirely on this laptop.
        </p>
      </section>

      <div className="hero-grid">
        <section className="talk-card">
          <div className="talk-card-head">
            <span className="card-kicker">Your voice key</span>
            <button type="button" className="text-link" onClick={() => onNavigate('settings')}>
              Change <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="talk-main">
            <div className="key-stack">
              <Keycap wide>{hotkey}</Keycap>
              <span className="key-hint">hold</span>
            </div>
            <div className="talk-copy">
              <strong>Speak naturally.</strong>
              <span>Release and it’s written at the cursor.</span>
            </div>
          </div>
          <div className="talk-wave">
            <Waveform mode="idle" demo />
          </div>
          <div className="talk-foot">
            <span>
              <Mic size={13} /> Works in every app
            </span>
            <span>
              <kbd>esc</kbd> cancels
            </span>
          </div>
        </section>

        <section className="stats-card">
          <div className="stats-top">
            <span className="stats-kicker">Today</span>
            <span className="stats-live">
              <span /> live
            </span>
          </div>
          <div className="stats-big">
            {stats.words.toLocaleString()}
            <span>words</span>
          </div>
          <div className="stats-sub">
            {stats.entries.length} dictation{stats.entries.length === 1 ? '' : 's'} ·{' '}
            {Math.round(stats.words / 40)} min saved
          </div>
          <Sparkline values={weekSeries(state)} />
          <div className="stats-foot">
            <span>≈ {Math.round(stats.words / 40)} min back vs. typing</span>
            <span className="stats-arrow">↗</span>
          </div>
        </section>
      </div>

      <section className="try-card">
        <div className="try-head">
          <div>
            <span className="card-kicker">A quiet place to try</span>
            <h2>Your cursor is the destination.</h2>
          </div>
          <div className="try-hint">
            <Keycap>{hotkey}</Keycap>
            <span>click the paper, then hold</span>
          </div>
        </div>
        <textarea
          className="try-pad"
          spellCheck={false}
          placeholder={`Click here and hold ${hotkey}. Say what you mean — it will land right here.`}
          aria-label="Dictation test pad"
        />
        <div className="try-foot">
          <span>
            <Sparkles size={13} /> Text is inserted wherever you are typing.
          </span>
          <button type="button" className="ghost-link" onClick={() => onNavigate('history')}>
            See everything you’ve said <ArrowUpRight size={13} />
          </button>
        </div>
      </section>

      <div className="flow-columns">
        <section className="panel recent-panel">
          <header className="panel-head">
            <div>
              <span className="card-kicker">Recent flow</span>
              <h2>What you said today</h2>
            </div>
            <button type="button" className="text-link" onClick={() => onNavigate('history')}>
              View all <ArrowUpRight size={13} />
            </button>
          </header>

          <div className="recent-list">
            {recent.map((entry, index) => (
              <article className="recent-row" key={entry.id} style={{ animationDelay: `${index * 45}ms` }}>
                <div className="recent-time">
                  <span>{clockTime(entry.createdAt)}</span>
                  <span className="recent-duration">{Math.max(1, Math.round(entry.durationMs / 1000))}s</span>
                </div>
                <p>{entry.text}</p>
                <div className="recent-actions">
                  <CopyButton text={entry.text} label="Copy" />
                </div>
              </article>
            ))}
            {recent.length === 0 && (
              <div className="empty-block">
                <Mic size={20} />
                <p>Your first dictation will land here.</p>
              </div>
            )}
          </div>
        </section>

        <div className="side-stack">
          <section className="panel words-panel">
            <header className="panel-head compact">
              <div>
                <span className="card-kicker">Your words</span>
                <h2>Taught to Hush</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => onNavigate('dictionary')}>
                <ArrowUpRight size={15} />
              </button>
            </header>
            <div className="chip-cloud">
              {state.dictionary.slice(0, 6).map((word) => (
                <span className="chip" key={word}>
                  {word}
                </span>
              ))}
              {state.dictionary.length === 0 && <span className="muted-copy">No custom words yet.</span>}
            </div>
            <button type="button" className="panel-link" onClick={() => onNavigate('dictionary')}>
              <BookOpen size={14} /> Teach Hush a new word
            </button>
          </section>

          <section className="panel snippets-panel">
            <header className="panel-head compact">
              <div>
                <span className="card-kicker">Shortcuts</span>
                <h2>Say less, write more</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => onNavigate('snippets')}>
                <ArrowUpRight size={15} />
              </button>
            </header>
            <div className="snippet-preview">
              {state.snippets.slice(0, 3).map((snippet) => (
                <div className="snippet-line" key={snippet.id}>
                  <span className="snippet-trigger">“{snippet.trigger}”</span>
                  <span className="snippet-arrow">→</span>
                  <span className="snippet-expansion">
                    {snippet.expansion.split('\n')[0].slice(0, 42)}
                    {snippet.expansion.length > 42 ? '…' : ''}
                  </span>
                </div>
              ))}
              {state.snippets.length === 0 && <span className="muted-copy">Turn phrases into paragraphs.</span>}
            </div>
            <button type="button" className="panel-link" onClick={() => onNavigate('snippets')}>
              <Zap size={14} /> Add a shortcut
            </button>
          </section>

          <section className="privacy-strip">
            <div className="privacy-strip-icon">
              <Clock3 size={15} />
            </div>
            <div>
              <strong>{minutesSaved} minutes</strong>
              <span>saved by talking instead of typing</span>
            </div>
          </section>
        </div>
      </div>

      <footer className="flow-footer">
        <span>
          <RibbonFooterMark /> Local inference. No account. No audio leaving the room.
        </span>
        <span className="flow-footer-words">{wordCount(state.history.map((entry) => entry.text).join(' '))} words captured</span>
      </footer>
    </div>
  )
}

function RibbonFooterMark() {
  return (
    <span className="footer-mark" aria-hidden="true">
      <svg viewBox="0 0 24 16" fill="none">
        <path
          d="M1 10c3 0 3-5 6-5s3 5 6 5 3-5 6-5 3 5 4 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
