import type React from 'react'
import { memo, useMemo } from 'react'
import type { DashboardProjectSnapshot } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView, buildCardSummary } from './card-view'
import CompactCard from './CompactCard'
import ExpandedWorkspace, { type WorkspaceTab } from './ExpandedWorkspace'
import type { DetailKey } from './guide-model'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  expanded: boolean
  onToggle: () => void
  onDelete: (projectId: string) => void
  onOpenSettings: (projectId: string) => void
  onExpandSection?: (section: number) => void
  initialTab?: WorkspaceTab
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
      syncing={syncing}
      onSync={() => void syncNow(project.id)}
      onSettings={() => onOpenSettings(project.id)}
      onRemove={() => onDelete(project.id)}
      onToggle={onToggle}
      initialTab={initialTab}
      initialGuideSection={initialGuideSection}
      initialDetailKey={initialDetailKey}
    />
  )
}

function sameProject(
  a: ProjectCardProps['snapshot']['project'],
  b: ProjectCardProps['snapshot']['project']
): boolean {
  return (
    a.name === b.name &&
    a.clientName === b.clientName &&
    a.teamName === b.teamName &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.manualCompletion === b.manualCompletion &&
    a.monitors.length === b.monitors.length &&
    a.monitors.every(
      (monitor, i) =>
        monitor.channelId === b.monitors[i].channelId &&
        monitor.channelName === b.monitors[i].channelName
    )
  )
}

export default memo(ProjectCardInner, (prev, next) => {
  return (
    prev.snapshot.project.id === next.snapshot.project.id &&
    sameProject(prev.snapshot.project, next.snapshot.project) &&
    prev.snapshot.lastUpdatedAt === next.snapshot.lastUpdatedAt &&
    prev.expanded === next.expanded &&
    prev.index === next.index &&
    prev.initialTab === next.initialTab &&
    prev.tabNonce === next.tabNonce &&
    prev.initialGuideSection === next.initialGuideSection &&
    prev.initialDetailKey === next.initialDetailKey
  )
})
