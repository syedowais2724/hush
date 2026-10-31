import {
  AudioWaveform,
  BookOpen,
  History,
  House,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { Page } from '../lib/types'
import { RibbonMark } from './RibbonMark'

const NAV: Array<{ id: Page; label: string; icon: typeof House }> = [
  { id: 'flow', label: 'Flow', icon: House },
  { id: 'history', label: 'History', icon: History },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'snippets', label: 'Snippets', icon: Zap },
]

export function Sidebar({
  page,
  historyCount,
  onNavigate,
}: {
  page: Page
  historyCount: number
  onNavigate: (page: Page) => void
}) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">
          <RibbonMark size={26} />
        </div>
        <div>
          <div className="brand-name">
            hush<span>.</span>
          </div>
          <div className="brand-tag">your voice, in place</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">Workspace</div>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item${page === id ? ' is-active' : ''}`}
            onClick={() => onNavigate(id)}
            title={label}
          >
            <Icon size={17} strokeWidth={1.7} />
            <span>{label}</span>
            {id === 'history' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}
            {page === id && <span className="nav-pip" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="privacy-card">
          <div className="privacy-icon">
            <ShieldCheck size={16} strokeWidth={1.7} />
          </div>
          <div>
            <div className="privacy-title">Private by default</div>
            <div className="privacy-copy">Audio never leaves this device.</div>
          </div>
        </div>

        <button
          type="button"
          className={`nav-item settings-link${page === 'settings' ? ' is-active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <Settings size={17} strokeWidth={1.7} />
          <span>Settings</span>
          {page === 'settings' && <span className="nav-pip" />}
        </button>

        <div className="sidebar-meta">
          <Sparkles size={12} />
          <span>Local models · offline</span>
        </div>
      </div>
    </aside>
  )
}
