import { Plus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import type { AppState } from '../lib/types'

export function DictionaryPage({
  state,
  onSave,
  onToast,
}: {
  state: AppState
  onSave: (words: string[]) => Promise<void>
  onToast: (message: string) => void
}) {
  const [value, setValue] = useState('')

  const counts = new Map<string, number>()
  for (const word of state.dictionary) {
    const needle = word.toLowerCase()
    const count = state.history.reduce((sum, entry) => {
      return sum + (entry.text.toLowerCase().split(needle).length - 1)
    }, 0)
    counts.set(word, count)
  }

  const add = async () => {
    const word = value.trim()
    if (!word) return
    if (state.dictionary.some((item) => item.toLowerCase() === word.toLowerCase())) {
      onToast('That word is already in your dictionary')
      return
    }
    if (state.dictionary.length >= 100) {
      onToast('Keep the list under 100 words for the best bias')
      return
    }
    await onSave([...state.dictionary, word])
    setValue('')
    onToast(`“${word}” will be favoured next time`)
  }

  const remove = async (word: string) => {
    await onSave(state.dictionary.filter((item) => item !== word))
    onToast('Removed from your dictionary')
  }

  return (
    <div className="page dictionary-page">
      <header className="page-top">
        <div className="page-top-left">
          <span className="page-kicker">Dictionary</span>
          <span className="page-date">Names, places, product words</span>
        </div>
        <div className="page-top-right">
          <div className="model-pill is-ready">
            <span className="model-dot" />
            {state.dictionary.length} / 100 words
          </div>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Teach it your language
          </span>
          <h1>
            The words you use <span className="hero-italic">are the words it hears.</span>
          </h1>
          <p className="page-lede">
            Whistle biases toward the names, brands and jargon you add here. It happens inside the
            decoder, before the text exists — not as an after-the-fact spell check.
          </p>
        </div>
      </section>

      <div className="dictionary-grid">
        <div className="dictionary-main">
          <section className="add-card">
            <div className="add-card-copy">
              <span className="card-kicker">Add a word or phrase</span>
              <h2>Make it sound like you.</h2>
            </div>
            <form
              className="add-row"
              onSubmit={(event) => {
                event.preventDefault()
                void add()
              }}
            >
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="e.g. Siobhán, Cactus Compute, Krzysztof…"
                aria-label="Add a dictionary word"
              />
              <button type="submit" className="primary-button" disabled={!value.trim()}>
                <Plus size={15} /> Add word
              </button>
            </form>
          </section>

          <section className="dictionary-list-card">
            <header className="panel-head">
              <div>
                <span className="card-kicker">Your vocabulary</span>
                <h2>{state.dictionary.length} word{state.dictionary.length === 1 ? '' : 's'} in rotation</h2>
              </div>
              <span className="list-note">Used on every dictation</span>
            </header>

            <div className="dictionary-list">
              {state.dictionary.map((word, index) => (
                <div className="dictionary-row" key={word}>
                  <span className="dictionary-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="dictionary-word">{word}</span>
                  <span className="dictionary-count">
                    {counts.get(word) ? `heard ${counts.get(word)}×` : 'waiting to be heard'}
                  </span>
                  <button
                    type="button"
                    className="icon-button subtle"
                    aria-label={`Remove ${word}`}
                    onClick={() => void remove(word)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {state.dictionary.length === 0 && (
                <div className="empty-block">
                  <Sparkles size={20} />
                  <p>Add your name first. It’s the word every dictation needs.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="how-card">
          <div className="how-badge">
            <Sparkles size={16} />
            How it works
          </div>
          <h2>Bias, not autocorrect.</h2>
          <p>
            During beam search, Whistle lifts the probability of your phrases. That means it can
            hear a name it has never seen — without a network call.
          </p>
          <ol className="how-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Add the spelling.</strong>
                <p>Names, acronyms, product names, the street you live on.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Speak normally.</strong>
                <p>Keywords are applied to both the live pass and the final pass.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Keep it short.</strong>
                <p>Under 100 entries keeps the bias sharp and the decode fast.</p>
              </div>
            </li>
          </ol>
          <div className="how-foot">
            <span className="model-dot" />
            Runs entirely on this machine
          </div>
        </aside>
      </div>
    </div>
  )
}
