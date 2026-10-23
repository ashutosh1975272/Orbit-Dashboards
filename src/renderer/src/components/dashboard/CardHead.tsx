import type React from 'react'

/** Shared card head row used by both CompactCard and the expanded ProjectCard. */
interface CardHeadProps {
  index: number
  name: string
  workspaceName: string
  clientName: string
  status: 'on-track' | 'at-risk' | 'blocked' | 'waiting-on-client' | null
  needsReply: boolean
  inactive: boolean
  aiBadge?: string
  syncing: boolean
  onSync: () => void
  onSettings: () => void
  onEdit?: () => void
  onRemove?: () => void
  onToggle: () => void
  expanded: boolean
  toggleLabel?: string
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'on-track': { bg: '#16342a', color: '#7be3b5' },
  'at-risk': { bg: '#3d2024', color: '#ff9a9a' },
  blocked: { bg: '#3a2f17', color: '#f5c46b' },
  'waiting-on-client': { bg: '#3d2a4c', color: '#a08cff' }
}

function statusPill(status: string): React.ReactElement {
  const s = STATUS_STYLES[status]
  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 600,
        padding: '4px 12px',
        borderRadius: '999px',
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap'
      }}
    >
      {status}
    </span>
  )
}

const SETTINGS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const EDIT_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const REMOVE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6m3 0V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2" />
  </svg>
)

const CHEVRON_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const ICON_BTN_STYLE: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '10px',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-btn)',
  color: 'var(--text)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

export default function CardHead({
  index,
  name,
  workspaceName,
  clientName,
  status,
  needsReply,
  inactive,
  aiBadge,
  syncing,
  onSync,
  onSettings,
  onEdit,
  onRemove,
  onToggle,
  expanded,
  toggleLabel
}: CardHeadProps): React.ReactElement {
  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px'
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>#{index + 1}</span>
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            margin: 0
          }}
          title={name}
        >
          {name}
        </h3>
        <span
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            whiteSpace: 'nowrap'
          }}
        >
          {workspaceName}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Client · {clientName || 'Not set'}
        </span>
        {status && statusPill(status)}
        {needsReply && (
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: '#3d2024', color: '#ff9a9a', whiteSpace: 'nowrap' }}>
            Needs my reply
          </span>
        )}
        {inactive && (
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: '#2b2a35', color: '#bdb9cc', whiteSpace: 'nowrap' }}>
            Inactive 24h+
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        {aiBadge && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{aiBadge}</span>
        )}
        <button
          type="button"
          style={{ ...ICON_BTN_STYLE, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '13px', fontWeight: 600, minHeight: '44px', padding: '8px 18px', minWidth: 0 }}
          disabled={syncing}
          onClick={onSync}
          title="Sync"
          aria-label="Sync"
        >
          {syncing ? 'Syncing…' : '⟳ Sync'}
        </button>
        <button
          type="button"
          style={ICON_BTN_STYLE}
          onClick={onSettings}
          title="Edit workspace and channels"
          aria-label="Edit workspace and channels"
        >
          {SETTINGS_ICON}
        </button>
        {expanded && onEdit && (
          <button
            type="button"
            style={ICON_BTN_STYLE}
            onClick={onEdit}
            title="Edit project details"
            aria-label="Edit project details"
          >
            {EDIT_ICON}
          </button>
        )}
        {expanded && onRemove && (
          <button
            type="button"
            style={{ ...ICON_BTN_STYLE, color: '#ff9a9a' }}
            onClick={onRemove}
            title="Remove project"
            aria-label="Remove project"
          >
            {REMOVE_ICON}
          </button>
        )}
        <button
          type="button"
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            fontSize: '13px',
            fontWeight: 600,
            minHeight: '44px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={toggleLabel ?? `${expanded ? 'Minimise' : 'Expand'} ${name}`}
        >
          {expanded ? 'Minimise' : 'Expand'}
          {CHEVRON_ICON}
        </button>
      </div>
    </header>
  )
}
