import type React from 'react'
import type { CardSummary } from './card-view'

interface CompactCardProps {
  summary: CardSummary
  expanded: boolean
  onToggle: () => void
  onExpandSection?: (section: number) => void
  onDelete: (id: string) => void
  onSync: (id: string) => void
  onEdit: () => void
  onSettings: () => void
  syncing: boolean
}

const MOOD_CLASSES: Record<string, string> = {
  good: 'bg-green-500/15 text-green-400 border-green-500/30',
  neutral: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  tense: 'bg-red-500/15 text-red-400 border-red-500/30'
}

export default function CompactCard({
  summary,
  expanded,
  onToggle,
  onExpandSection,
  onDelete: _onDelete,
  onSync: _onSync,
  onEdit: _onEdit,
  onSettings: _onSettings,
  syncing: _syncing
}: CompactCardProps): React.ReactElement {
  const {
    projectId, index, name, workspaceName, clientName, status, needsReply, inactive,
    situationLine, recentLine, nextStep, progress, dates, daysUsed, daysTotal, pace, paceLabel,
    week, lastClientAt, myLastReplyAt, counts
  } = summary

  const maxBar = Math.max(...week.map((b) => b.count), 1)

  const fmtAge = (iso: string | null): string => {
    if (!iso) return '—'
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
  }

  const paceClass = pace === 'behind'
    ? 'text-red-400'
    : pace === 'ahead'
      ? 'text-purple-400'
      : 'text-green-400'

  return (
    <article
      className="dash-card dash-card-compact bg-surface-2-dark border border-border-dark rounded-xl overflow-hidden transition-all duration-200"
      id={`dash-card-anchor-${projectId}`}
      data-testid={`dash-card-${index}`}
      style={{ borderRadius: '12px' }}
    >
      <div
        className="dash-card-head-compact flex items-center justify-between gap-4 p-4 cursor-pointer"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        {/* LEFT: Identity */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ maxWidth: '35%' }}>
          <span className="text-xs text-muted-dark/60">#{index + 1}</span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate" title={name}>{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-dark truncate">{clientName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 whitespace-nowrap">
                {workspaceName}
              </span>
            </div>
          </div>
        </div>

        {/* CENTRE: Situation + Next Step */}
        <div className="flex-1 min-w-0 px-4">
          <p className="text-sm text-text-dark line-clamp-2 leading-relaxed">{situationLine || 'No summary yet'}</p>
          {recentLine && <p className="text-xs text-muted-dark mt-1 truncate">Just changed: {recentLine}</p>}
          {nextStep && <p className="text-xs font-medium mt-1 truncate" style={{ color: 'var(--accent)' }}>→ {nextStep}</p>}
        </div>

        {/* RIGHT: Numbers */}
        <div className="flex items-center gap-4 flex-shrink-0" style={{ maxWidth: '30%' }}>
          {/* Progress */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-bold text-text-dark">{progress}%</span>
            <div className="w-16 h-1.5 bg-border-dark rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-dim))' }} />
            </div>
          </div>

          {/* Time + Pace */}
          <div className="flex flex-col items-end gap-0.5">
            {dates.startDate && dates.endDate ? (
              <>
                <span className="text-xs text-muted-dark">{daysUsed ?? 0}d / {daysTotal ?? 0}d</span>
                <span className={`text-xs font-medium ${paceClass}`}>{paceLabel}</span>
              </>
            ) : (
              <span className="text-xs text-muted-dark">Dates not stated</span>
            )}
          </div>

          {/* 7-day bars */}
          <div className="flex items-end gap-0.5 h-8">
            {week.map((bar, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm"
                style={{
                  height: `${Math.max(2, (bar.count / maxBar) * 100)}%`,
                  background: bar.isToday ? 'var(--success)' : 'var(--accent)',
                  opacity: bar.isToday ? 1 : 0.6
                }}
                title={`${bar.date}: ${bar.count}`}
              />
            ))}
          </div>

          {/* Last messages */}
          <div className="flex flex-col gap-0.5 text-xs text-muted-dark">
            <span>Client: {fmtAge(lastClientAt)}</span>
            <span>Me: {fmtAge(myLastReplyAt)}</span>
          </div>

          {/* Expand button */}
          <button
            type="button"
            className="w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-accent/10 hover:border-accent transition-colors flex items-center justify-center flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status pills row */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        {status && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${MOOD_CLASSES[status === 'at-risk' ? 'tense' : status === 'blocked' ? 'tense' : 'neutral']}`}>
            {status}
          </span>
        )}
        {needsReply && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-500/15 text-red-400 border-red-500/30">
            ⚠ needs reply
          </span>
        )}
        {inactive && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
            Inactive 24h+
          </span>
        )}
        {/* Footer chips */}
        {counts.questions > 0 && (
          <button type="button" className="px-2 py-0.5 rounded-full text-xs border border-border-dark text-muted-dark hover:border-accent hover:text-accent transition-colors" onClick={(e) => { e.stopPropagation(); onToggle(); onExpandSection?.(1) }}>
            {counts.questions} questions
          </button>
        )}
        {counts.blockers > 0 && (
          <button type="button" className="px-2 py-0.5 rounded-full text-xs border border-border-dark text-muted-dark hover:border-accent hover:text-accent transition-colors" onClick={(e) => { e.stopPropagation(); onToggle(); onExpandSection?.(2) }}>
            {counts.blockers} blockers
          </button>
        )}
        {counts.risks > 0 && (
          <button type="button" className="px-2 py-0.5 rounded-full text-xs border border-border-dark text-muted-dark hover:border-accent hover:text-accent transition-colors" onClick={(e) => { e.stopPropagation(); onToggle(); onExpandSection?.(3) }}>
            {counts.risks} risks
          </button>
        )}
        {counts.files > 0 && (
          <button type="button" className="px-2 py-0.5 rounded-full text-xs border border-border-dark text-muted-dark hover:border-accent hover:text-accent transition-colors" onClick={(e) => { e.stopPropagation(); onToggle(); onExpandSection?.(6) }}>
            {counts.files} files
          </button>
        )}
      </div>
    </article>
  )
}
