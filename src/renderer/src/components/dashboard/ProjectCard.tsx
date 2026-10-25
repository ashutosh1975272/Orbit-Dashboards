import type React from 'react'
import { memo, useMemo } from 'react'
import type { DashboardProjectSnapshot } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView, buildCardSummary } from './card-view'
import { sameProjectForCard } from './project-card-compare'
import CompactCard from './CompactCard'
import ExpandedWorkspace from './ExpandedWorkspace'
import type { WorkspaceEntryTab } from './workspace-nav'
import type { DetailKey } from './guide-model'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  expanded: boolean
  onToggle: () => void
  onDelete: (projectId: string) => void
  onOpenSettings: (projectId: string) => void
  onExpandSection?: (section: number) => void
  initialTab?: WorkspaceEntryTab
  tabNonce?: number
  initialGuideSection?: number
  initialDetailKey?: DetailKey
}

function ProjectCardInner({
  snapshot,
  index,
  expanded,
  onToggle,
  onDelete,
  onOpenSettings,
  onExpandSection,
  initialTab,
  tabNonce,
  initialGuideSection,
  initialDetailKey
}: ProjectCardProps): React.ReactElement {
  const project = snapshot.project
  const syncNow = useDashboardStore((s) => s.syncNow)
  const openWizard = useDashboardStore((s) => s.openWizard)
  const syncingIds = useDashboardStore((s) => s.syncingProjectIds)
  const syncing = syncingIds.includes(project.id)

  const view = useMemo(() => buildCardView(snapshot, index), [snapshot, index])
  const summary = useMemo(() => buildCardSummary(snapshot, index), [snapshot, index])

  if (!expanded) {
    return (
      <CompactCard
        summary={summary}
        onToggle={onToggle}
        onExpandSection={onExpandSection}
        onSync={(id) => void syncNow(id)}
        onSettings={() => onOpenSettings(project.id)}
        onRemove={() => onDelete(project.id)}
        syncing={syncing}
      />
    )
  }

  return (
    <ExpandedWorkspace
      key={`${project.id}:${initialTab ?? ''}:${tabNonce ?? 0}:${initialGuideSection ?? ''}:${initialDetailKey ?? ''}`}
      view={view}
      summary={summary}
      project={project}
      snapshot={snapshot}
      syncing={syncing}
      onSync={() => void syncNow(project.id)}
      onSettings={() => onOpenSettings(project.id)}
      onEdit={() => openWizard(project.id)}
      onRemove={() => onDelete(project.id)}
      onToggle={onToggle}
      initialTab={initialTab}
      initialGuideSection={initialGuideSection}
      initialDetailKey={initialDetailKey}
    />
  )
}

export default memo(ProjectCardInner, (prev, next) => {
  return (
    prev.snapshot.project.id === next.snapshot.project.id &&
    sameProjectForCard(prev.snapshot.project, next.snapshot.project) &&
    prev.snapshot.lastUpdatedAt === next.snapshot.lastUpdatedAt &&
    prev.snapshot.insightUpdatedAt === next.snapshot.insightUpdatedAt &&
    prev.snapshot.syncState === next.snapshot.syncState &&
    prev.snapshot.ourWorkspaceError === next.snapshot.ourWorkspaceError &&
    prev.snapshot.metrics === next.snapshot.metrics &&
    prev.expanded === next.expanded &&
    prev.index === next.index &&
    prev.initialTab === next.initialTab &&
    prev.tabNonce === next.tabNonce &&
    prev.initialGuideSection === next.initialGuideSection &&
    prev.initialDetailKey === next.initialDetailKey
  )
})
