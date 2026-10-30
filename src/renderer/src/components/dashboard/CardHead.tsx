import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import ProjectPinButton from './ProjectPinButton'

export interface CardHeadFlag {
  label: string
  tone: 'success' | 'warn' | 'danger' | 'muted'
}

export type CardViewMode = 'insights' | 'live'

/** Header for the expanded project workspace. Identity on the left, one
 *  secondary action plus a menu on the right. Only states that are true are
 *  shown — never a strip of dimmed pills standing in for filters. */
interface CardHeadProps {
  name: string
  workspaceName: string
  clientName: string
  aiBadge?: string
  flags?: CardHeadFlag[]
  viewMode?: CardViewMode
  onViewModeChange?: (mode: CardViewMode) => void
  syncing: boolean
  onSync: () => void
  onScrape?: () => void
  scraping?: boolean
  onLogs?: () => void
  onWatchLive?: () => void
  onSettings: () => void
  onEdit: () => void
  onRemove?: () => void
  onToggle: () => void
  pinned?: boolean
  onTogglePin?: () => void
}

function MoreGlyph(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}

export default function CardHead({
  name,
  workspaceName,
  clientName,
  aiBadge,
  flags,
  viewMode: _viewMode = 'insights',
  onViewModeChange: _onViewModeChange,
  syncing,
  onSync,
  onScrape,
  scraping = false,
  onLogs,
  onWatchLive,
  onSettings,
  onEdit,
  onRemove,
  onToggle,
  pinned = false,
  onTogglePin
}: CardHeadProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <header className="ws-head">
      <div className="ws-head-main">
        <div className="ws-head-title">
          <h3 title={name}>{name}</h3>
          {flags && flags.length > 0 ? (
            <span className="ws-head-flags">
              {flags.map((flag) => (
                <span key={flag.label} className={`ws-flag is-${flag.tone}`}>
                  {flag.label}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="ws-head-meta">
          <span className="ws-head-ws">{workspaceName}</span>
          {clientName && clientName !== workspaceName ? (
            <span className="ws-head-client">{clientName}</span>
          ) : null}
          {aiBadge ? (
            <span className="ws-head-ai">
              {aiBadge.split(' · ').map((part, i) => (
                <span key={i}>{part}</span>
              ))}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ws-head-actions">
        {onTogglePin ? (
          <ProjectPinButton
            pinned={pinned}
            projectName={name}
            onToggle={onTogglePin}
            className="ws-head-pin"
          />
        ) : null}
        {onLogs ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onLogs}
            aria-label="Scraping logs"
            title="View scraping run history and messages"
          >
            📋 Logs
          </button>
        ) : null}
        {onWatchLive ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onWatchLive}
            aria-label="Watch live scraping"
            title="Watch real-time browser scraping with cursor overlay"
          >
            👀 Watch Live
          </button>
        ) : null}
        {onScrape ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={scraping || syncing}
            onClick={onScrape}
            aria-label="Scrape channels"
            title="Scrape Slack messages via browser session"
          >
            {scraping ? 'Scraping…' : '🕷 Scrape'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={syncing || scraping}
          onClick={onSync}
          aria-label="Sync project"
        >
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
        <div className="dash-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="btn btn-icon"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${name}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreGlyph />
          </button>
          {menuOpen ? (
            <div
              className="dash-menu"
              role="menu"
              aria-label={`Actions for ${name}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setMenuOpen(false)
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onEdit()
                  setMenuOpen(false)
                }}
              >
                Edit project
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSettings()
                  setMenuOpen(false)
                }}
              >
                Project settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggle()
                  setMenuOpen(false)
                }}
              >
                Collapse
              </button>
              {onRemove ? (
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    onRemove()
                    setMenuOpen(false)
                  }}
                >
                  Delete project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
