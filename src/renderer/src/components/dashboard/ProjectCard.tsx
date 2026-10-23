import type React from 'react'
import { memo } from 'react'
import { useMemo, useState } from 'react'
import type {
  DashboardProjectSnapshot,
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView, buildCardSummary } from './card-view'
import CardHead from './CardHead'
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
  const [leftW, setLeftW] = useState(290)
  const [rightW, setRightW] = useState(290)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

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

  if (!expanded) {
    return (
      <CompactCard
        summary={summary}
        expanded={false}
        onToggle={onToggle}
        onExpandSection={onExpandSection}
        onSync={(id) => void syncNow(id)}
        onEdit={() => { setStartDate(project.startDate ?? ''); setEndDate(project.endDate ?? ''); setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : ''); setEditOpen(true) }}
        onSettings={() => openWizard(project.id)}
        syncing={syncing}
      />
    )
  }

  return (
    <article
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '16px', padding: '18px 20px', width: '100%', containerType: 'inline-size' } as any}
      id={`dash-card-anchor-${project.id}`}
      data-testid={`dash-card-${index}`}
    >
      <CardHead
        index={index}
        name={identity.name}
        workspaceName={identity.teamName}
        clientName={identity.clientName}
        status={centre.status}
        needsReply={summary.needsReply}
        inactive={summary.inactive}
        aiBadge={aiBadge}
        syncing={syncing}
        onSync={() => void syncNow(project.id)}
        onEdit={() => { setStartDate(project.startDate ?? ''); setEndDate(project.endDate ?? ''); setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : ''); setEditOpen(true) }}
        onRemove={() => onDelete(project.id)}
        onSettings={() => openWizard(project.id)}
        onToggle={onToggle}
        expanded={expanded}
      />


      {/* BODY: 3 columns, never wraps */}
      <div style={{ display: 'grid', gridTemplateColumns: `${leftCollapsed ? '66px' : leftW + 'px'} minmax(0, 1fr) ${rightCollapsed ? '66px' : rightW + 'px'}`, gap: '16px', alignItems: 'stretch', height: '100%', minHeight: '0', overflow: 'hidden' }}>
        <LeftSidebar data={leftSidebar} projectId={project.id} onWidthChange={setLeftW} onCollapseChange={setLeftCollapsed} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, overflow: 'hidden' }}>
          <CentreVisuals visuals={centre.visuals} />
          <CentreContent centre={centre} />
        </div>
        <RightSidebar data={rightSidebar} projectId={project.id} onWidthChange={setRightW} onCollapseChange={setRightCollapsed} />
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
