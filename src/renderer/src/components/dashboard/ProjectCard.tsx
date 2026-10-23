import type React from 'react'
import { memo, useMemo, useState } from 'react'
import type { DashboardProjectSnapshot } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView, buildCardSummary } from './card-view'
import CompactCard from './CompactCard'
import ExpandedWorkspace from './ExpandedWorkspace'
import type { DetailKey } from './guide-model'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  expanded: boolean
  onToggle: () => void
  onDelete: (projectId: string) => void
  onExpandSection?: (section: number) => void
  initialGuideSection?: number
  initialDetailKey?: DetailKey
}

function ProjectCardInner({
  snapshot,
  index,
  expanded,
  onToggle,
  onDelete,
  onExpandSection,
  initialGuideSection,
  initialDetailKey
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

  const openEdit = (): void => {
    setStartDate(project.startDate ?? '')
    setEndDate(project.endDate ?? '')
    setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : '')
    setEditOpen(true)
  }

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
        onEdit={openEdit}
        onSettings={() => openWizard(project.id)}
        syncing={syncing}
      />
    )
  }

  return (
    <>
      <ExpandedWorkspace
        key={`${project.id}:${initialGuideSection ?? ''}:${initialDetailKey ?? ''}`}
        view={view}
        summary={summary}
        syncing={syncing}
        onSync={() => void syncNow(project.id)}
        onSettings={() => openWizard(project.id)}
        onEdit={openEdit}
        onRemove={() => onDelete(project.id)}
        onToggle={onToggle}
        initialGuideSection={initialGuideSection}
        initialDetailKey={initialDetailKey}
      />

      {editOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setEditOpen(false)}
        >
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-panel)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            role="dialog"
            aria-label="Edit project schedule"
            onClick={(e) => e.stopPropagation()}
          >
            <header
              style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                Edit {project.name}
              </h3>
            </header>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Start date (blank = use dates found in chat)
              </p>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '8px',
                  color: 'var(--text)'
                }}
              />
            </label>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>End date / deadline</p>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '8px',
                  color: 'var(--text)'
                }}
              />
            </label>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Manually set completion % (0–100, overrides the estimate)
              </p>
              <input
                type="number"
                min={0}
                max={100}
                value={completion}
                onChange={(e) => setCompletion(e.target.value)}
                placeholder="auto"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '8px',
                  color: 'var(--text)'
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-panel)',
                  color: 'var(--text)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onClick={() => void saveMeta()}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default memo(ProjectCardInner, (prev, next) => {
  return (
    prev.snapshot.project.id === next.snapshot.project.id &&
    prev.snapshot.lastUpdatedAt === next.snapshot.lastUpdatedAt &&
    prev.expanded === next.expanded &&
    prev.index === next.index &&
    prev.initialGuideSection === next.initialGuideSection &&
    prev.initialDetailKey === next.initialDetailKey
  )
})
