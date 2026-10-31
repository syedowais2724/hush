import { ArrowRight, Plus, Quote, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import type { AppState, Snippet } from '../lib/types'

export function SnippetsPage({
  state,
  onSave,
  onToast,
}: {
  state: AppState
  onSave: (snippets: Snippet[]) => Promise<void>
  onToast: (message: string) => void
}) {
  const [trigger, setTrigger] = useState('')
  const [expansion, setExpansion] = useState('')

  const add = async () => {
    const nextTrigger = trigger.trim()
    const nextExpansion = expansion.trim()
    if (!nextTrigger || !nextExpansion) return
    if (state.snippets.some((item) => item.trigger.toLowerCase() === nextTrigger.toLowerCase())) {
      onToast('That trigger already exists')
      return
    }
    const snippet: Snippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trigger: nextTrigger,
      expansion: nextExpansion,
    }
    await onSave([snippet, ...state.snippets])
    setTrigger('')
    setExpansion('')
    onToast(`“${nextTrigger}” is now a shortcut`)
  }

  const remove = async (id: string) => {
    await onSave(state.snippets.filter((item) => item.id !== id))
    onToast('Shortcut removed')
  }

  return (
    <div className="page snippets-page">
      <header className="page-top">
        <div className="page-top-left">
          <span className="page-kicker">Snippets</span>
          <span className="page-date">Phrases that become paragraphs</span>
        </div>
        <div className="page-top-right">
          <div className="model-pill is-ready">
            <span className="model-dot" />
            {state.snippets.length} shortcut{state.snippets.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Say less, write more
          </span>
          <h1>
            Small phrase. <span className="hero-italic">Full thought.</span>
          </h1>
          <p className="page-lede">
            Say a short trigger and Hush writes the whole thing. Perfect for addresses, intros,
            sign-offs, and the things you type a hundred times a week.
          </p>
        </div>
      </section>

      <div className="snippets-grid">
        <div className="snippets-list">
          {state.snippets.map((snippet) => (
            <article className="snippet-card" key={snippet.id}>
              <div className="snippet-card-top">
                <div className="snippet-voice">
                  <Quote size={14} />
                  <span>{snippet.trigger}</span>
                </div>
                <button
                  type="button"
                  className="icon-button subtle"
                  aria-label={`Remove ${snippet.trigger}`}
                  onClick={() => void remove(snippet.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="snippet-card-arrow">
                <ArrowRight size={14} />
              </div>
              <p className="snippet-card-body">{snippet.expansion}</p>
            </article>
          ))}

          {state.snippets.length === 0 && (
            <div className="empty-state">
              <div className="empty-mark">
                <Zap size={22} />
              </div>
              <h2>No shortcuts yet.</h2>
              <p>Start with something you type every day. “My address” is a good first one.</p>
            </div>
          )}
        </div>

        <aside className="snippet-form-card">
          <div className="snippet-form-head">
            <span className="card-kicker">New shortcut</span>
            <h2>Speak a phrase.<br />Get a paragraph.</h2>
          </div>

          <label className="field">
            <span className="field-label">When I say</span>
            <input
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
              placeholder="my address"
              aria-label="Snippet trigger"
            />
          </label>

          <label className="field">
            <span className="field-label">Write this instead</span>
            <textarea
              value={expansion}
              onChange={(event) => setExpansion(event.target.value)}
              placeholder="Flat 4, 22 Marlowe Street, London"
              rows={4}
              aria-label="Snippet expansion"
            />
          </label>

          <button
            type="button"
            className="primary-button full"
            disabled={!trigger.trim() || !expansion.trim()}
            onClick={() => void add()}
          >
            <Plus size={15} /> Save shortcut
          </button>

          <p className="form-note">
            Matched as a whole phrase, case-insensitive, after Whistle writes the sentence. Your
            trigger stays in the final text if it isn’t an exact match.
          </p>

          <div className="example-snippets">
            <span className="field-label">Try one of these</span>
            <div className="example-row">
              {[
                ['my phone', '+44 7700 900 123'],
                ['intro line', 'Hey — quick note before I forget.'],
                ['meeting link', 'https://meet.google.com/…'],
              ].map(([exampleTrigger, exampleExpansion]) => (
                <button
                  type="button"
                  className="example-chip"
                  key={exampleTrigger}
                  onClick={() => {
                    setTrigger(exampleTrigger)
                    setExpansion(exampleExpansion)
                  }}
                >
                  {exampleTrigger}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
