import type React from 'react'
import { useMemo, useState } from 'react'
import type { RecentActivity } from '../../../../shared/dashboard-contract'

/**
 * v2.3 — the "Recent" strip: the newest IMPORTANT changes across all
 * workspaces. Items are ranked by importance (a workspace waiting on the
 * client outranks a quiet one), never merged, and every item names its
 * workspace.
 */

interface RecentStripProps {
  items: RecentActivity[]
  onSelect?: (projectId: string) => void
}

const STATUS_CLASS: Record<string, string> = {
  'on-track': 'insight-status-on-track',
  'at-risk': 'insight-status-at-risk',
  blocked: 'insight-status-blocked',
  'waiting-on-client': 'insight-status-waiting-on-client'
}

function fmtAge(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export default function RecentStrip({
  items,
  onSelect
}: RecentStripProps): React.ReactElement | null {
  const [urgentOnly, setUrgentOnly] = useState(false)

  const visible = useMemo(() => {
    const filtered = urgentOnly
      ? items.filter((i) => i.needsReply || i.status === 'blocked' || i.status === 'at-risk')
      : items
    return filtered.slice(0, 6)
  }, [items, urgentOnly])

  if (items.length === 0) return null

  return (
    <section className="dash-recent" data-testid="dash-recent">
      <header className="dash-recent-head">
        <h3>Recent — most important first</h3>
        <div className="dash-recent-toggle">
          <button
            type="button"
            className={urgentOnly ? '' : 'is-active'}
            onClick={() => setUrgentOnly(false)}
          >
            All
          </button>
          <button
            type="button"
            className={urgentOnly ? 'is-active' : ''}
            onClick={() => setUrgentOnly(true)}
          >
            Urgent only
          </button>
        </div>
      </header>

      <div className="dash-recent-strip">
        {visible.length === 0 ? (
          <p className="dash-empty">Nothing urgent right now.</p>
        ) : (
          visible.map((item) => (
            <button
              key={`${item.projectId}-${item.ts}`}
              type="button"
              className="dash-recent-card"
              data-testid={`dash-recent-${item.projectId}`}
              onClick={() => onSelect?.(item.projectId)}
              title={item.oneLine}
            >
              <span className="dash-recent-top">
                <span className="dash-recent-workspace">{item.teamName}</span>
                <span className={`dash-chip ${STATUS_CLASS[item.status] ?? ''}`}>
                  {item.status}
                </span>
              </span>
              <span className="dash-recent-project">{item.projectName}</span>
              <span className="dash-recent-line">{item.oneLine || 'No activity yet'}</span>
              <span className="dash-recent-foot">
                {item.needsReply ? <span className="dash-recent-badge">⚠ reply</span> : null}
                {item.delta ? <span className="dash-recent-badge">↑ {item.delta}</span> : null}
                <span className="dash-recent-time">{fmtAge(item.ts)}</span>
                {item.channelName ? (
                  <span className="dash-recent-channel">#{item.channelName}</span>
                ) : null}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
