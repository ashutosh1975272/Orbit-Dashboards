import type React from 'react'
import CardHead from './CardHead'
import type { CardSummary } from './card-view'

interface CompactCardProps {
  summary: CardSummary
  expanded: boolean
  onToggle: () => void
  onExpandSection?: (section: number) => void
  onSync: (id: string) => void
  onEdit: () => void
  onSettings: () => void
  syncing: boolean
}

const PACE_COLOR: Record<string, string> = {
  behind: 'var(--danger)',
  ahead: 'var(--accent)',
  'on-pace': 'var(--success)'
}

function chip(label: string, onClick: () => void): React.ReactElement {
  return (
    <button
      type="button"
      style={{
        height: '36px',
        padding: '0 12px',
        borderRadius: '999px',
        border: '1px solid var(--border-btn)',
        background: 'var(--bg-panel)',
        color: 'var(--text-soft)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {label}
    </button>
  )
}

export default function CompactCard({
  summary,
  expanded,
  onToggle,
  onExpandSection,
  onSync,
  onEdit,
  onSettings,
  syncing
}: CompactCardProps): React.ReactElement {
  const {
    projectId, index, name, workspaceName, clientName, status, needsReply, inactive,
    situationLine, justChanged, nextStep, progress, dates, daysUsed, daysTotal, pace, paceLabel,
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

  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '16px',
        padding: '16px 20px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflow: 'hidden'
      }}
      id={`dash-card-anchor-${projectId}`}
      data-testid={`dash-card-${index}`}
    >
      <CardHead
        index={index}
        name={name}
        workspaceName={workspaceName}
        clientName={clientName}
        status={status}
        needsReply={needsReply}
        inactive={inactive}
        syncing={syncing}
        onSync={() => void onSync(projectId)}
        onEdit={onEdit}
        onSettings={onSettings}
        onToggle={onToggle}
        expanded={expanded}
      />

      {/* ROW 1: three zones */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', width: '100%' }}>
        {/* Zone A: situation + just changed + next step */}
        <div style={{ flex: 3, minWidth: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} data-testid="dash-situation">
            {situationLine || 'No summary yet'}
          </p>
          {justChanged && (
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', margin: 0, whiteSpace: 'nowrap' }} data-testid="dash-just-changed">
              Just changed: {justChanged}
            </p>
          )}
          {nextStep && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '15px', fontWeight: 600, lineHeight: 1.4, display: 'inline-flex', alignItems: 'center', gap: '8px' }} data-testid="dash-next-step">
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>NEXT STEP</span>
              {nextStep}
            </div>
          )}
        </div>

        {/* Zone B: progress + time + pace */}
        <div style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '10px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>{progress}%</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{daysUsed != null && daysTotal != null ? `${daysUsed} of ${daysTotal} days` : '—'}</span>
            </div>
            <div style={{ height: '10px', width: '100%', background: 'var(--track)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, background: 'var(--accent)', borderRadius: '5px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dates.startDate && dates.endDate ? `${fmtAge(dates.startDate)} → ${fmtAge(dates.endDate)}` : 'Dates not stated'}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: PACE_COLOR[pace] ?? 'var(--text-muted)' }}>{paceLabel}</span>
            </div>
          </div>
        </div>

        {/* Zone C: last 7 days + last messages */}
        <div style={{ flex: 1.2, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '10px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-label)' }}>LAST 7 DAYS</span>
            <div style={{ display: 'flex', alignItems: 'end', gap: '5px', height: '36px' }}>
              {week.map((bar) => (
                <div
                  key={bar.date}
                  style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '2px', flex: 1 }}
                  title={`${bar.date}: ${bar.count} messages`}
                >
                  <div style={{ width: '100%', borderRadius: '2px 2px 0 0', height: `${Math.round((bar.count / Math.max(maxBar, 1)) * 34) + 3}px`, background: bar.isToday ? 'var(--success)' : '#5b4f86' }} />
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{bar.isToday ? 'T' : new Date(bar.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Client {fmtAge(lastClientAt)}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Me {fmtAge(myLastReplyAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: count chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {counts.questions > 0 && chip(`${counts.questions} open question${counts.questions === 1 ? '' : 's'}`, () => { onToggle(); onExpandSection?.(1) })}
        {counts.blockers > 0 && chip(`${counts.blockers} blocker${counts.blockers === 1 ? '' : 's'}`, () => { onToggle(); onExpandSection?.(2) })}
        {counts.risks > 0 && chip(`${counts.risks} risk${counts.risks === 1 ? '' : 's'}`, () => { onToggle(); onExpandSection?.(3) })}
        {counts.files > 0 && chip(`${counts.files} file${counts.files === 1 ? '' : 's'}`, () => { onToggle(); onExpandSection?.(6) })}
        {counts.requirements > 0 && chip(`${counts.requirements} requirement${counts.requirements === 1 ? '' : 's'}`, () => { onToggle(); onExpandSection?.(5) })}
      </div>

      {/* Minimise / Expand toggle */}
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px'
        }}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Minimise' : 'Expand'} ${name}`}
      >
        {expanded ? 'Minimise' : 'Expand'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </article>
  )
}
