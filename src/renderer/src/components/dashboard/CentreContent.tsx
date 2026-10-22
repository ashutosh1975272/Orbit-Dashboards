import type React from 'react'
import type { CardCentre } from './card-view'

interface CentreContentProps {
  centre: CardCentre
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function CentreContent({ centre }: CentreContentProps): React.ReactElement {
  return (
    <div className="dash-centre-content p-4 space-y-3">
      {/* Status & Needs Reply Pills */}
      <div className="dash-centre-pills flex flex-wrap gap-2">
        {centre.status ? (
          <span
            className={`dash-chip px-2 py-1 rounded-full text-xs font-medium border ${
              centre.status === 'on-track' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
              centre.status === 'at-risk' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
              centre.status === 'blocked' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
              'bg-purple-500/15 text-purple-400 border-purple-500/30'
            }`}
            title={centre.statusReason}
          >
            {centre.status}
          </span>
        ) : null}
        {centre.needsReply ? (
          <span
            className="dash-chip px-2 py-1 rounded-full text-xs font-semibold border bg-red-500/15 text-red-400 border-red-500/30"
            title={centre.openQuestions.join('\n')}
            data-testid="dash-needs-reply"
          >
            ⚠ needs my reply
            {centre.urgency !== 'normal' ? ` (${centre.urgency})` : ''}
          </span>
        ) : null}
        {centre.statusChange && (
          <span className="dash-chip px-2 py-1 rounded-full text-xs font-medium border bg-purple-500/15 text-purple-400 border-purple-500/30" title="Status changed this refresh">
            {centre.statusChange}
          </span>
        )}
      </div>

      {/* Situation Line - Largest text, read first */}
      {centre.situationLine && (
        <p className="dash-insight-situation text-lg font-medium leading-relaxed text-text-dark" data-testid="dash-situation">
          {centre.situationLine}
        </p>
      )}

      {/* Just Changed */}
      {centre.recentLine && (
        <p className="dash-insight-recent text-sm text-muted-dark" data-testid="dash-recent-line">
          ↻ just changed: {centre.recentLine}
        </p>
      )}

      {/* Highlights (up to 3) */}
      {centre.highlights.length > 0 && (
        <ul className="dash-insight-highlights list-disc list-inside space-y-1 text-sm text-text-dark">
          {centre.highlights.slice(0, 3).map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="dash-insight-what">{h.what}</span>
              {h.who && <span className="dash-insight-meta text-xs text-muted-dark"> · {h.who}</span>}
              {h.whenIso && <span className="dash-insight-meta text-xs text-muted-dark"> · {formatTime(h.whenIso)}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* Last Client Message Box */}
      {centre.lastClientMessage ? (
        <div className="dash-insight-client-box p-3 bg-purple-500/8 border border-border-dark rounded-lg border-l-3 border-accent">
          <p className="dash-insight-client-quote text-sm leading-relaxed italic text-text-dark mb-2">"{centre.lastClientMessage.quote}"</p>
          <div className="dash-insight-client-meta flex flex-wrap items-center gap-2">
            <span className="dash-insight-meta text-xs text-muted-dark">{centre.lastClientMessage.who}</span>
            <span className="dash-insight-meta text-xs text-muted-dark">{formatTime(centre.lastClientMessage.whenIso)}</span>
            {centre.needsReply && (
              <>
                <span className="dash-chip px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-500/15 text-red-400 border-red-500/30">needs reply</span>
                <span className={`dash-chip px-2 py-0.5 rounded-full text-xs font-medium border ${
                  centre.urgency === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                  centre.urgency === 'low' ? 'bg-gray-500/15 text-gray-400 border-gray-500/30' :
                  'bg-purple-500/15 text-purple-400 border-purple-500/30'
                }`}>
                  {centre.urgency}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="dash-insight-meta text-sm text-muted-dark italic">no client message yet</p>
      )}

      {/* Open Questions */}
      {centre.openQuestions.length > 0 && (
        <ul className="dash-insight-questions list-disc list-inside space-y-1 text-sm text-yellow-400">
          {centre.openQuestions.slice(0, 3).map((q, i) => (
            <li key={i}>? {q}</li>
          ))}
        </ul>
      )}

      {/* Next Step Bar - Prominent */}
      {centre.nextStep && (
        <p className="dash-insight-next mt-2 px-3 py-2 bg-purple-500/15 border border-purple-500/30 rounded-lg text-sm font-semibold text-purple-400" data-testid="dash-next-step">
          → next: {centre.nextStep}
        </p>
      )}
    </div>
  )
}