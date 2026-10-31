import { Minus, Square, X } from 'lucide-react'
import { api, isDesktop } from '../lib/api'
import { RibbonMark } from './RibbonMark'

export function WindowBar() {
  return (
    <div className="window-bar">
      <div className="window-bar-brand">
        <RibbonMark size={14} />
        <span>Hush</span>
        <span className="window-bar-sep">/</span>
        <span className="window-bar-muted">private dictation</span>
      </div>
      <div className="window-bar-drag" />
      <div className="window-controls">
        <button type="button" aria-label="Minimize" onClick={() => void api.minimize()}>
          <Minus size={13} strokeWidth={1.8} />
        </button>
        <button type="button" aria-label="Maximize" onClick={() => void api.maximize()}>
          <Square size={10} strokeWidth={1.8} />
        </button>
        <button type="button" className="window-close" aria-label="Close" onClick={() => void api.close()}>
          <X size={13} strokeWidth={1.8} />
        </button>
      </div>
      {!isDesktop && <span className="window-web-note">web preview</span>}
    </div>
  )
}
