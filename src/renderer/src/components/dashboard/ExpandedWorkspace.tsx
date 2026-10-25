import type React from 'react'
import { useMemo } from 'react'
import type { DashboardProject } from '../../../../shared/dashboard-contract'
import type { CardSummary, CardView } from './card-view'
import CardHead, { type CardHeadFlag } from './CardHead'
import { useWorkspaceNav } from '../../hooks/useWorkspaceNav'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceContent from './WorkspaceContent'
import type { NavEntry, WorkspaceEntryTab } from './workspace-nav'
import type { DetailKey } from './guide-model'

interface ExpandedWorkspaceProps {
  view: CardView
  summary: CardSummary
  project: DashboardProject
  syncing: boolean
  onSync: () => void
  onSettings: () => void
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  /** Force a starting view (card-header gear opens Settings). */
  initialTab?: WorkspaceEntryTab
  /** Force a starting guide section (compact chip deep-link). */
  initialGuideSection?: number
  /** Force a starting detail (compact chip deep-link). */
  initialDetailKey?: DetailKey
}

const STATUS_FLAGS: Record<string, CardHeadFlag> = {
  'on-track': { label: 'On track', tone: 'success' },
  'at-risk': { label: 'At risk', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'danger' },
  'waiting-on-client': { label: 'Waiting on client', tone: 'warn' }
}

export default function ExpandedWorkspace({
  view,
  summary,
  project,
  syncing,
  onSync,
  onSettings,
  onEdit,
  onRemove,
  onToggle,
  initialTab,
  initialGuideSection,
  initialDetailKey
}: ExpandedWorkspaceProps): React.ReactElement {
  const { identity } = view

  const entry: NavEntry | null = useMemo(() => {
    if (!initialTab && !initialGuideSection && !initialDetailKey) return null
    return { initialTab, initialGuideSection, initialDetailKey }
  }, [initialTab, initialGuideSection, initialDetailKey])
  const { nav, openGroup, select, toggleSection, toggleInfoGroup, toggleCollapse, resize } =
    useWorkspaceNav(summary.projectId, entry)

  const statusFlag: CardHeadFlag | null = summary.status
    ? (STATUS_FLAGS[summary.status] ?? { label: summary.status, tone: 'muted' })
    : null

  const headFlags: CardHeadFlag[] = [
    ...(statusFlag ? [statusFlag] : []),
    ...(summary.needsReply ? [{ label: 'Needs my reply', tone: 'danger' as const }] : []),
    ...(summary.inactive ? [{ label: 'Inactive 24h+', tone: 'muted' as const }] : [])
  ]

  return (
    <article
      className="ws-shell"
      id={`dash-card-anchor-${summary.projectId}`}
      data-testid={`dash-card-${summary.index}`}
      data-expanded="true"
    >
      <CardHead
        name={identity.name}
        workspaceName={identity.teamName}
        clientName={identity.clientName}
        aiBadge={view.aiBadge}
        flags={headFlags}
        syncing={syncing}
        onSync={onSync}
        onSettings={onSettings}
        onEdit={onEdit}
        onRemove={onRemove}
        onToggle={onToggle}
      />

      <div
        className={`ws-body${nav.collapsed ? ' is-collapsed' : ''}`}
        style={{ '--ws-nav-w': `${nav.width}px` } as React.CSSProperties}
      >
        <WorkspaceSidebar
          view={view}
          nav={nav}
          onOpenGroup={openGroup}
          onSelect={select}
          onToggleSection={toggleSection}
          onToggleInfoGroup={toggleInfoGroup}
          onToggleCollapse={toggleCollapse}
          onResize={resize}
        />
        <WorkspaceContent view={view} summary={summary} project={project} nav={nav} />
      </div>
    </article>
  )
}
