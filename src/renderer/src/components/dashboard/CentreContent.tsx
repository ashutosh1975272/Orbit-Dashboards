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
    <div className="dash-centre-content flex flex-col gap-4">
      {/* SUMMARY panel */}
      <div className="dash-panel" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '14px', padding: '16px 20px' }}>
        <span className="dash-panel-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--text-label)', display: 'block', marginBottom: '12px' }}>Summary</span>
        {centre.situationLine && (
          <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '8px' }} data-testid="dash-situation">
            {centre.situationLine}
          </p>
        )}
        {centre.recentLine && (
          <p style={{ fontSize: '14px', color: 'var(--text-soft)', marginBottom: '12px' }} data-testid="dash-recent-line">
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Just changed:</span> {centre.recentLine}
          </p>
        )}
        {centre.nextStep && (
          <div style={{ marginTop: '4px', padding: '12px 16px', borderRadius: '10px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '15px', fontWeight: 600 }} data-testid="dash-next-step">
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px', opacity: 0.8 }}>Next Step</span>
            {centre.nextStep}
          </div>
        )}
      </div>

      {/* HIGHLIGHTS panel */}
      {centre.highlights.length > 0 && (
        <div className="dash-panel" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '14px', padding: '16px 20px' }}>
          <span className="dash-panel-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--text-label)', display: 'block', marginBottom: '12px' }}>Highlights</span>
          {centre.highlights.slice(0, 3).map((h, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border-panel)' : 'none', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'var(--text)', flex: 1, minWidth: '200px' }}>{h.what}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {h.who && `${h.who}`}{h.whenIso && ` · ${formatTime(h.whenIso)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* LAST CLIENT MESSAGE panel */}
      <div className="dash-panel" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '14px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--text-label)' }}>Last Client Message</span>
          {centre.needsReply && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ff9a9a' }}>Needs my reply · {centre.urgency} urgency</span>
          )}
        </div>
        {centre.lastClientMessage ? (
          <>
            <p style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
              "{centre.lastClientMessage.quote}"
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {centre.lastClientMessage.who} · {formatTime(centre.lastClientMessage.whenIso)}
            </p>
            {centre.openQuestions.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {centre.openQuestions.slice(0, 3).map((q, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#f5c46b', marginBottom: '4px' }}>? {q}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No client message yet</p>
        )}
      </div>
    </div>
  )
}
