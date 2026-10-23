import type React from 'react'
import { memo } from 'react'
import { useMemo, useState } from 'react'
import type {
  DashboardProjectSnapshot,
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView, buildCardSummary } from './card-view'
import LeftSidebar from './LeftSidebar'
import CentreVisuals from './CentreVisuals'
import CentreContent from './CentreContent'
import CompactCard from './CompactCard'
import RightSidebar from './RightSidebar'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  expanded: boolean
  onToggle: () => void
  onDelete: (projectId: string) => void
  onExpandSection?: (section: number) => void
}

function ProjectCardInner({
  snapshot,
  index,
  expanded,
  onToggle,
  onDelete,
  onExpandSection
}: ProjectCardProps): React.ReactElement {
  const project = snapshot.project
  const syncNow = useDashboardStore((s) => s.syncNow)
  const syncingIds = useDashboardStore((s) => s.syncingProjectIds)
  const syncing = syncingIds.includes(project.id)
  const openWizard = useDashboardStore((s) => s.openWizard)

  const [editOpen, setEditOpen] = useState(false)

  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [completion, setCompletion] = useState(String(project.manualCompletion ?? ''))

  const view = useMemo(() => buildCardView(snapshot, index), [snapshot, index])
  const summary = useMemo(() => buildCardSummary(snapshot, index), [snapshot, index])
  const { identity, leftSidebar, centre, rightSidebar, aiBadge } = view

  const saveMeta = async (): Promise<void> => {
    await useDashboardStore.getState().upsertProject({
      ...project,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      manualCompletion:
        completion === '' ? undefined : Math.max(0, Math.min(100, Number(completion)))
    })
    setEditOpen(false)
  }

  const timeElapsed = centre.visuals.timeElapsed

  if (!expanded) {
    return (
      <CompactCard
        summary={summary}
        expanded={false}
        onToggle={onToggle}
        onExpandSection={onExpandSection}
        onDelete={onDelete}
        onSync={(id) => void syncNow(id)}
        onEdit={() => { setStartDate(project.startDate ?? ''); setEndDate(project.endDate ?? ''); setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : ''); setEditOpen(true) }}
        onSettings={() => openWizard(project.id)}
        syncing={syncing}
      />
    )
  }

  return (
    <article
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '16px', padding: '18px 20px', '--left-w': '290px', '--right-w': '290px' } as React.CSSProperties}
      id={`dash-card-anchor-${project.id}`}
      data-testid={`dash-card-${index}`}
    >
      {/* HEAD */}
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>#{index + 1}</span>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }} title={project.name}>{identity.name}</h3>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{identity.teamName}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Client · {identity.clientName || 'Not set'}</span>
          {centre.status && (
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: centre.status === 'on-track' ? '#16342a' : centre.status === 'at-risk' ? '#3d2024' : '#3a2f17', color: centre.status === 'on-track' ? '#7be3b5' : centre.status === 'at-risk' ? '#ff9a9a' : '#f5c46b' }}>
              {centre.status}
            </span>
          )}
          {centre.needsReply && (
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: '#3d2024', color: '#ff9a9a' }}>Needs my reply</span>
          )}
          {!timeElapsed.hasDates && identity.dates.badge === 'not stated in chat' && (
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: '#2b2a35', color: '#bdb9cc' }}>Inactive 24h+</span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{aiBadge}</span>
          <button type="button" style={{ padding: '8px 18px', borderRadius: '10px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', fontSize: '13px', fontWeight: 600, minHeight: '44px', cursor: 'pointer' }} disabled={syncing} onClick={() => void syncNow(project.id)}>
            {syncing ? 'Syncing…' : '⟳ Sync'}
          </button>
          <button type="button" style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border-btn)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => openWizard(project.id)} title="Edit workspace and channels" aria-label="Edit workspace and channels">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border-btn)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setStartDate(project.startDate ?? ''); setEndDate(project.endDate ?? ''); setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : ''); setEditOpen(true) }} title="Edit project details" aria-label="Edit project details">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border-btn)', color: '#ff9a9a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onDelete(project.id)} title="Remove project" aria-label="Remove project">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6m3 0V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2"/></svg>
          </button>
          <button type="button" style={{ padding: '8px 14px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, minHeight: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Minimise' : 'Expand'} ${identity.name}`}>
            {expanded ? 'Minimise' : 'Expand'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </header>

      {/* BODY: 3 columns, never wraps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--left-w, 290px) minmax(0, 1fr) var(--right-w, 290px)', gap: '16px', alignItems: 'stretch', minHeight: '500px', width: '100%' }}>
        <LeftSidebar data={leftSidebar} projectId={project.id} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <CentreVisuals visuals={centre.visuals} />
          <CentreContent centre={centre} />
        </div>
        <RightSidebar data={rightSidebar} projectId={project.id} />
      </div>

      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setEditOpen(false)}>
          <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-panel)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-label="Edit project schedule" onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Edit {project.name}</h3>
            </header>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Start date (blank = use dates found in chat)</p>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>End date / deadline</p>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manually set completion % (0–100, overrides the estimate)</p>
              <input type="number" min={0} max={100} value={completion} onChange={(e) => setCompletion(e.target.value)} placeholder="auto" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text)' }} />
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ flex: 1, padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-panel)', color: 'var(--text)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setEditOpen(false)}>Cancel</button>
              <button style={{ flex: 1, padding: '8px 16px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => void saveMeta()}>Save</button>
            </div>
          </section>
        </div>
      )}
    </article>
  )
}

export default memo(ProjectCardInner, (prev, next) => {
  return prev.snapshot.project.id === next.snapshot.project.id &&
    prev.snapshot.lastUpdatedAt === next.snapshot.lastUpdatedAt &&
    prev.expanded === next.expanded &&
    prev.index === next.index
})
