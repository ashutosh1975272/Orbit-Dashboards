import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { DashboardProject, DashboardTeamWorkspace } from '../../../../shared/dashboard-contract'
import type { CardSummary, CardView } from './card-view'
import CardHead, { type CardHeadFlag } from './CardHead'
import { useWorkspaceNav } from '../../hooks/useWorkspaceNav'
import { useSlackChannels } from '../../hooks/useSlackChannels'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceContent from './WorkspaceContent'
import { buildConnectorChannelLists, type NavEntry, type WorkspaceEntryTab } from './workspace-nav'
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
  const {
    nav,
    openGroup,
    select,
    toggleSection,
    toggleInfoGroup,
    toggleConnector,
    toggleCollapse,
    resize
  } = useWorkspaceNav(summary.projectId, entry)
  const listing = useSlackChannels(project, 'client')
  const [teamWorkspace, setTeamWorkspace] = useState<DashboardTeamWorkspace | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.api.dashboard
      .getTeamWorkspace()
      .then((workspace) => {
        if (cancelled) return
        setTeamWorkspace(workspace)
        setTeamLoading(false)
      })
      .catch(() => {
        if (!cancelled) setTeamLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const channelLists = useMemo(
    () =>
      buildConnectorChannelLists({
        clientLoading: listing.loading,
        clientError: listing.error,
        clientChannels: listing.channels,
        // The card reads only the channels pinned in Global settings, not every
        // channel the team token can reach.
        teamLoading,
        teamChannels: (teamWorkspace?.channels ?? []).map((c) => ({
          id: c.channelId,
          name: c.channelName
        })),
        teamConnected: teamWorkspace?.connected ?? false,
        watchedChannels: identity.channels.map((c) => ({
          id: c.channelId,
          name: c.channelName
        }))
      }),
    [listing, teamLoading, teamWorkspace, identity.channels]
  )

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
          channels={channelLists}
          onOpenGroup={openGroup}
          onSelect={select}
          onToggleSection={toggleSection}
          onToggleInfoGroup={toggleInfoGroup}
          onToggleConnector={toggleConnector}
          onToggleCollapse={toggleCollapse}
          onResize={resize}
        />
        <WorkspaceContent
          view={view}
          summary={summary}
          project={project}
          nav={nav}
          channels={channelLists}
        />
      </div>
    </article>
  )
}
