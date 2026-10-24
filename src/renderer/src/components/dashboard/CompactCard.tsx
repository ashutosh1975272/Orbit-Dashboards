import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CardSummary } from './card-view'

interface CompactCardProps {
  summary: CardSummary
  onToggle: () => void
  onExpandSection?: (section: number) => void
  onSync: (id: string) => void
  onSettings: () => void
  onRemove: () => void
  syncing: boolean
}

const STATUS_LABEL: Record<string, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  blocked: 'Blocked',
  'waiting-on-client': 'Waiting on client'
}

function fmtAge(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function MoreGlyph(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}

/** One dense project row. Everything that needs a decision is on the line;
 *  the full workspace opens in place when the row is activated. */
export default function CompactCard({
  summary,
  onToggle,
  onExpandSection,
  onSync,
  onSettings,
  onRemove,
  syncing
}: CompactCardProps): React.ReactElement {
  const {
    projectId, index, name, workspaceName, clientName, status, needsReply,
    situationLine, progress, paceLabel, lastClientAt, counts
  } = summary

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

  const openSection = (section: number): void => {
    if (onExpandSection) onExpandSection(section)
    else onToggle()
  }

  const statusLabel = status ? STATUS_LABEL[status] ?? status : null
  const age = lastClientAt ? fmtAge(lastClientAt) : null
  const ageLabel = age ? (age === 'now' ? 'now' : `${age} ago`) : '—'
  const activityTitle = age
    ? `Last client message ${age} ago`
    : 'No client messages yet'

  return (
    <article
      className={`proj-row${status ? ` is-${status}` : ''}`}
      id={`dash-card-anchor-${projectId}`}
      data-testid={`dash-card-${index}`}
    >
      <span className="proj-row-bar" aria-hidden />

      <div className="proj-row-body">
        <button
          type="button"
          className="proj-row-main"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Open ${name}`}
        >
          <span className="proj-row-head">
            <span className="proj-row-name">{name}</span>
            <span className="proj-row-ws">{workspaceName}</span>
            {clientName && clientName !== workspaceName ? (
              <span className="proj-row-client">{clientName}</span>
            ) : null}
            {statusLabel ? (
              <span className="proj-row-status">{statusLabel}</span>
            ) : null}
          </span>
          <span className="proj-row-line">{situationLine || 'No summary yet'}</span>
        </button>

        {counts.questions + counts.blockers + counts.risks > 0 ? (
          <div className="proj-row-chips">
            {counts.questions > 0 ? (
              <button type="button" className="proj-chip" onClick={() => openSection(101)}>
                {counts.questions} {counts.questions === 1 ? 'question' : 'questions'}
              </button>
            ) : null}
            {counts.blockers > 0 ? (
              <button type="button" className="proj-chip is-danger" onClick={() => openSection(102)}>
                {counts.blockers} {counts.blockers === 1 ? 'blocker' : 'blockers'}
              </button>
            ) : null}
            {counts.risks > 0 ? (
              <button type="button" className="proj-chip is-warn" onClick={() => openSection(103)}>
                {counts.risks} {counts.risks === 1 ? 'risk' : 'risks'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="proj-row-side">
        {needsReply ? <span className="proj-flag">Needs reply</span> : null}
        <span className="proj-meter" title={`${progress}% complete. ${paceLabel}`}>
          <span className="proj-meter-bar">
            <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </span>
          <span className="proj-meter-num">{progress}%</span>
        </span>
        <span className="proj-age" title={activityTitle}>
          {ageLabel}
        </span>
      </div>

      <div className="proj-actions">
        <div className="dash-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="proj-more"
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
                disabled={syncing}
                onClick={() => {
                  onSync(projectId)
                  setMenuOpen(false)
                }}
              >
                {syncing ? 'Syncing…' : 'Sync now'}
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
                className="is-danger"
                onClick={() => {
                  onRemove()
                  setMenuOpen(false)
                }}
              >
                Delete project
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="proj-chevron"
          onClick={onToggle}
          aria-label={`Open ${name}`}
          tabIndex={-1}
        />
      </div>
    </article>
  )
}
