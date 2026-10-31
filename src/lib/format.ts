import type { Settings, Snippet } from './types'

const SPOKEN_PUNCTUATION: Array<[RegExp, string]> = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\bnew line\b/gi, '\n'],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (?:mark|point)\b/gi, '!'],
  [/\bfull stop\b/gi, '.'],
  [/\bperiod\b/gi, '.'],
  [/\bcomma\b/gi, ','],
  [/\bsemicolon\b/gi, ';'],
  [/\bcolon\b/gi, ':'],
  [/\bdash\b/gi, ' — '],
]

const FILLERS = /\b(?:um|uh|erm|hmm)\b[,.]?\s*/gi

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function applySpokenPunctuation(text: string): string {
  let output = text
  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) {
    output = output.replace(pattern, replacement)
  }
  return output
}

export function applySnippets(text: string, snippets: Snippet[]): string {
  if (!snippets.length) return text
  let output = text
  const sorted = [...snippets].sort((a, b) => b.trigger.length - a.trigger.length)
  for (const snippet of sorted) {
    const trigger = snippet.trigger.trim()
    if (!trigger) continue
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(^|\\s)${escaped}(?=$|[\\s.,!?;:])`, 'gi')
    output = output.replace(pattern, (match, prefix: string) => `${prefix}${snippet.expansion}`)
  }
  return output
}

export function tidy(text: string, settings: Settings): string {
  let output = text.replace(/\r\n/g, '\n').trim()
  if (!output) return ''

  if (settings.cleanup) {
    output = output.replace(FILLERS, '')
    output = output.replace(/\b(\w+)(\s+\1\b)+/gi, '$1')
  }

  output = output
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s\n])/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()

  if (settings.autoCapitalize) {
    output = output
      .replace(/\bi\b/g, 'I')
      .replace(/(^|[.!?]\s+|\n)([a-z])/g, (_match, prefix: string, letter: string) => {
        return `${prefix}${letter.toUpperCase()}`
      })
  }

  return output
}

export function formatTranscript(
  raw: string,
  settings: Settings,
  snippets: Snippet[],
): string {
  let output = raw.trim()
  if (!output) return ''

  if (settings.spokenPunctuation) output = applySpokenPunctuation(output)
  if (snippets.length) output = applySnippets(output, snippets)

  return tidy(output, settings)
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minute = 60_000
  if (diff < minute) return 'just now'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp)
}

export function dayLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function clockTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

export function duration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
