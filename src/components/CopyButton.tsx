import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'

export function CopyButton({
  text,
  className = '',
  label = 'Copy',
}: {
  text: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await api.copyText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable in a plain browser preview.
    }
  }

  return (
    <button type="button" className={`copy-button ${className}`} onClick={() => void copy()} aria-label={label}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  )
}
