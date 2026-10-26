import type React from 'react'
import type { RecentActivity } from '../../../../shared/dashboard-contract'
import { recentReason } from './dashboard-page-selectors'

interface RecentStripProps {
  items: RecentActivity[]
  pinnedIds: ReadonlySet<string>
  onOpen: (projectId: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  blocked: 'Blocked',
  'waiting-on-client': 'Waiting on client'
}

const REASON_LABEL = {
  'reply-owed': 'Reply owed',
  blocked: 'Blocked',
  'at-risk': 'At risk',
  'waiting-on-client': 'Waiting on client',
  'new-activity': 'New activity'
} as const

function ageLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return ''
  if (hours < 1) return 'now'
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`
  return `${Math.round(hours / 24)}d`
}

export default function RecentStrip({
  items,
  pinnedIds,
  onOpen
}: RecentStripProps): React.ReactElement | null {
  const seen = new Set<string>()
  const visible = items
    .filter((item) => {
      if (seen.has(item.projectId)) return false
      seen.add(item.projectId)
      return true
    })
    .slice(0, 6)
  if (visible.length === 0) return null
  return (
    <section className="dash-section dash-recent" aria-labelledby="dash-recent-title">
      <div className="dash-section-head">
        <h2 id="dash-recent-title">Recent</h2>
      </div>
      <div className="dash-recent-rail">
        {visible.map((item) => {
          const reason = recentReason(item)
          const pinned = pinnedIds.has(item.projectId)
          return (
            <button
              key={item.projectId}
              type="button"
              className={`dash-recent-card${pinned ? ' is-pinned' : ''}`}
              onClick={() => onOpen(item.projectId)}
              aria-label={`Open ${item.projectName}`}
            >
              <span className="dash-recent-top">
                <span className="dash-recent-ws" title={item.teamName}>
                  {item.teamName}
                </span>
                <span className="dash-recent-flags">
                  {pinned ? (
                    <span className="dash-recent-pin" title="Pinned" aria-label="Pinned">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M15.5 3.5 20.5 8.5 17.5 9.5 13.5 13.5 13.5 18.5 5.5 10.5 10.5 10.5 14.5 6.5 15.5 3.5Z" />
                      </svg>
                    </span>
                  ) : null}
                  <span className={`dash-recent-status is-${item.status}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </span>
              </span>
              <span className="dash-recent-name" title={item.projectName}>
                {item.projectName}
              </span>
              <span className="dash-recent-line" title={item.oneLine || item.text}>
                {item.oneLine || item.text || 'No summary yet'}
              </span>
              <span className="dash-recent-foot">
                <span className={`dash-recent-reason is-${reason}`}>{REASON_LABEL[reason]}</span>
                {ageLabel(item.hoursSinceLastMessage) ? (
                  <span className="dash-recent-age">{ageLabel(item.hoursSinceLastMessage)}</span>
                ) : null}
                {item.channelName ? (
                  <span className="dash-recent-channel">#{item.channelName}</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
