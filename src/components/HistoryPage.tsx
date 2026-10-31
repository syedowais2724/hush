import { Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppState } from '../lib/types'
import { clockTime, dayLabel, duration } from '../lib/format'
import { CopyButton } from './CopyButton'

export function HistoryPage({
  state,
  onDelete,
  onClear,
  onToast,
}: {
  state: AppState
  onDelete: (id: string) => Promise<void>
  onClear: () => Promise<void>
  onToast: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return state.history
    return state.history.filter((entry) => entry.text.toLowerCase().includes(needle))
  }, [query, state.history])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const entry of filtered) {
      const label = dayLabel(entry.createdAt)
      const current = map.get(label) ?? []
      current.push(entry)
      map.set(label, current)
    }
    return [...map.entries()]
  }, [filtered])

  const totalWords = filtered.reduce((sum, entry) => sum + entry.words, 0)

  return (
    <div className="page history-page">
      <header className="page-top">
        <div className="page-top-left">
          <span className="page-kicker">History</span>
          <span className="page-date">Local only · never uploaded</span>
        </div>
        <div className="page-top-right">
          <div className="model-pill is-ready">
            <span className="model-dot" />
            {state.history.length} saved
          </div>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Every word, kept close
          </span>
          <h1>
            A record of <span className="hero-italic">your thinking out loud.</span>
          </h1>
          <p className="page-lede">
            {state.history.length} dictation{state.history.length === 1 ? '' : 's'} ·{' '}
            {state.history.reduce((sum, entry) => sum + entry.words, 0).toLocaleString()} words. Stored
            on this machine, nowhere else.
          </p>
        </div>
        {state.history.length > 0 && (
          <div className="heading-actions">
            {confirming ? (
              <div className="confirm-row">
                <span>Clear everything?</span>
                <button
                  type="button"
                  className="danger-button"
                  onClick={async () => {
                    await onClear()
                    setConfirming(false)
                    onToast('History cleared')
                  }}
                >
                  Yes, clear
                </button>
                <button type="button" className="ghost-button" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" className="ghost-button" onClick={() => setConfirming(true)}>
                <Trash2 size={14} /> Clear all
              </button>
            )}
          </div>
        )}
      </section>

      <div className="history-toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your words…"
            aria-label="Search history"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="history-summary">
          {filtered.length} result{filtered.length === 1 ? '' : 's'} · {totalWords.toLocaleString()} words
        </div>
      </div>

      <div className="history-groups">
        {groups.map(([label, entries]) => (
          <section className="history-group" key={label}>
            <header className="history-group-head">
              <h2>{label}</h2>
              <span>{entries.reduce((sum, entry) => sum + entry.words, 0)} words</span>
            </header>
            <div className="history-list">
              {entries.map((entry) => (
                <article className="history-row" key={entry.id}>
                  <div className="history-time">
                    <span>{clockTime(entry.createdAt)}</span>
                    <span>{duration(entry.durationMs)}</span>
                  </div>
                  <p>{entry.text}</p>
                  <div className="history-meta">
                    <span>{entry.words}w</span>
                    {entry.language && <span>{entry.language.toUpperCase()}</span>}
                  </div>
                  <div className="history-actions">
                    <CopyButton text={entry.text} label="Copy" />
                    <button
                      type="button"
                      className="icon-button subtle"
                      aria-label="Delete dictation"
                      onClick={async () => {
                        await onDelete(entry.id)
                        onToast('Dictation removed')
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-mark">
              <Search size={22} />
            </div>
            <h2>{query ? 'Nothing matches that.' : 'Nothing here yet.'}</h2>
            <p>
              {query
                ? 'Try a different word or phrase.'
                : 'Hold your voice key anywhere and your words will collect here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
