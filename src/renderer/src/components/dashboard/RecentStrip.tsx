import type React from 'react'
import { useMemo, useState } from 'react'
import type { RecentActivity } from '../../../../shared/dashboard-contract'

/**
 * v2.4 — the "Recent" strip: the newest IMPORTANT changes across all
 * workspaces. Items are ranked by importance (a workspace waiting on the
 * client outranks a quiet one), never merged, and every item names its
 * workspace.
 */

interface RecentStripProps {
  items: RecentActivity[]
  onSelect?: (projectId: string) => void
}

const STATUS_CLASSES: Record<string, string> = {
  'on-track': 'bg-green-500/15 text-green-400 border-green-500/30',
  'at-risk': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  blocked: 'bg-red-500/15 text-red-400 border-red-500/30',
  'waiting-on-client': 'bg-purple-500/15 text-purple-400 border-purple-500/30'
}

function fmtAge(iso: string): string {
  const t = new Date(iso).getTime()
  const mins = Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : 0
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export default function RecentStrip({
  items: rawItems,
  onSelect
}: RecentStripProps): React.ReactElement | null {
  const items = Array.isArray(rawItems) ? rawItems : []
  const [filter, setFilter] = useState<'all' | 'urgent' | 'inactive'>('all')

  const now = Date.now()
  const getHoursSince = (ts: string) => Math.max(0, (now - new Date(ts).getTime()) / 3_600_000)

  const visible = useMemo(() => {
    let filtered = items
    if (filter === 'urgent') {
      filtered = items.filter((i) => i.needsReply || i.status === 'blocked' || i.status === 'at-risk')
    } else if (filter === 'inactive') {
      filtered = items.filter((i) => getHoursSince(i.ts) >= 24)
    }
    return filtered.slice(0, 6)
  }, [items, filter])

  if (items.length === 0) return null

  const allCount = items.length
  const urgentCount = items.filter((i) => i.needsReply || i.status === 'blocked' || i.status === 'at-risk').length
  const inactiveCount = items.filter((i) => getHoursSince(i.ts) >= 24).length

  return (
    <section className="dash-recent w-full max-w-7xl mx-auto mb-6" data-testid="dash-recent">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-dark">
          Recent — most important first
        </h3>
        <div className="flex gap-2" role="tablist" aria-label="Filter recent items">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-surface-dark text-muted-dark border border-border-dark hover:bg-accent/10 hover:text-text-dark'
            }`}
            onClick={() => setFilter('all')}
          >
            All {allCount}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'urgent'}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'urgent'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-surface-dark text-muted-dark border border-border-dark hover:bg-accent/10 hover:text-text-dark'
            }`}
            onClick={() => setFilter('urgent')}
          >
            Urgent {urgentCount}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'inactive'}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'inactive'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-surface-dark text-muted-dark border border-border-dark hover:bg-accent/10 hover:text-text-dark'
            }`}
            onClick={() => setFilter('inactive')}
          >
            Inactive 24h+ {inactiveCount}
          </button>
        </div>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-px px-px" role="list" aria-label="Recent workspaces">
        {visible.length === 0 ? (
          <p className="text-muted-dark text-sm self-center whitespace-nowrap">Nothing matches this filter.</p>
        ) : visible.map((item) => (
          <button
            key={`${item.projectId}-${item.ts}`}
            type="button"
            role="listitem"
            className="dash-recent-card flex-none flex flex-col gap-2 w-[320px] h-[160px] p-4 bg-surface-dark border border-border-dark rounded-xl cursor-pointer text-left text-text-dark transition-all hover:border-accent hover:bg-accent/10 hover:shadow-lg"
            data-testid={`dash-recent-${item.projectId}`}
            onClick={() => onSelect?.(item.projectId)}
            title={item.oneLine}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-dark border border-border-dark rounded-full px-2 py-0.5 whitespace-nowrap truncate max-w-[120px]">
                {item.teamName}
              </span>
              <span className={`dash-chip px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASSES[item.status] ?? ''}`}>
                {item.status}
              </span>
            </div>
            <span className="font-bold text-sm truncate">{item.projectName}</span>
            <span className="text-sm text-text-dark line-clamp-2 leading-relaxed">
              {item.oneLine || 'No activity yet'}
            </span>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-dark">
              {item.needsReply && (
                <span className="font-semibold text-yellow-400">⚠ reply</span>
              )}
              {item.delta && (
                <span className="text-yellow-400">↑ {item.delta}</span>
              )}
              <span>{fmtAge(item.ts)}</span>
              {item.channelName && (
                <span className="text-muted-dark/70">#{item.channelName}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}