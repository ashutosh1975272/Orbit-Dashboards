import React, { useMemo, useState, useEffect } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'
import { useProfileStore } from '../../hooks/useProfiles'
import { useWorkspaceNav } from '../../hooks/useWorkspaceNav'
import { useSlackChannels } from '../../hooks/useSlackChannels'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceContent from './WorkspaceContent'
import CardHead, { type CardHeadFlag } from './CardHead'
import { CardAddModal } from './CardAddModal'
import { RunLogsModal } from './RunLogsModal'
import { buildCardView, buildCardSummary } from './card-view'
import { buildConnectorChannelLists } from './workspace-nav'
import type { DashboardTeamWorkspace } from '../../../../shared/dashboard-contract'
import { profileDisplayLabel } from '../../../../shared/types'
import ErrorBoundary from './ErrorBoundary'

const STATUS_FLAGS: Record<string, CardHeadFlag> = {
  'on-track': { label: 'On track', tone: 'success' },
  'at-risk': { label: 'At risk', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'danger' },
  'waiting-on-client': { label: 'Waiting on client', tone: 'warn' }
}

export function CosmicWorkspaceView(): React.JSX.Element | null {
  const cosmicSelectedCardId = useDashboardStore((s) => s.cosmicSelectedCardId)
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const syncNow = useDashboardStore((s) => s.syncNow)
  const syncSource = useDashboardStore((s) => s.syncSource)
  const openWizard = useDashboardStore((s) => s.openWizard)
  const profiles = useProfileStore((s) => s.profiles)

  const [cardAddOpen, setCardAddOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [teamWorkspace, setTeamWorkspace] = useState<DashboardTeamWorkspace | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  // Ensure snapshot is loaded
  useEffect(() => {
    if (!snapshot) {
      void loadSnapshot().catch(() => undefined)
    }
  }, [snapshot, loadSnapshot])

  // Query team workspace for connector channel listing
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

  // Selected project snapshot
  const activeProjectSnapshot = useMemo(() => {
    if (!snapshot || !cosmicSelectedCardId) return null
    return snapshot.projects.find((p) => p.project.id === cosmicSelectedCardId) ?? null
  }, [snapshot, cosmicSelectedCardId])

  const project = activeProjectSnapshot?.project

  const profileName = useMemo(() => {
    if (!project) return ''
    const profile = profiles.find((p) => p.id === project.profileId)
    return profile ? profileDisplayLabel(profile) : ''
  }, [profiles, project])

  const cardView = useMemo(() => {
    if (!activeProjectSnapshot) return null
    return buildCardView(activeProjectSnapshot)
  }, [activeProjectSnapshot])

  const cardSummary = useMemo(() => {
    if (!activeProjectSnapshot) return null
    return buildCardSummary(activeProjectSnapshot, 0)
  }, [activeProjectSnapshot])

  const listing = useSlackChannels(project ?? null, 'client')

  const channelLists = useMemo(() => {
    if (!project) {
      return buildConnectorChannelLists({
        clientLoading: false,
        clientError: null,
        clientChannels: [],
        watchedChannels: [],
        teamLoading: false,
        teamChannels: [],
        teamWatched: [],
        teamConnected: false
      })
    }
    const projectTeamChannels = project.ourSlackChannels?.map((c) => ({
      id: c.channelId,
      name: c.channelName
    }))
    const teamListed = projectTeamChannels?.length
      ? projectTeamChannels
      : (teamWorkspace?.channels ?? []).map((c) => ({ id: c.channelId, name: c.channelName }))
    return buildConnectorChannelLists({
      clientLoading: listing.loading,
      clientError: listing.error,
      clientChannels: listing.channels,
      watchedChannels: project.monitors.map((c) => ({
        id: c.channelId,
        name: c.channelName
      })),
      teamLoading,
      teamChannels: teamListed,
      teamWatched: projectTeamChannels ?? [],
      teamConnected: Boolean(teamWorkspace?.connected || projectTeamChannels?.length)
    })
  }, [project, listing, teamLoading, teamWorkspace])

  const {
    nav,
    openGroup,
    select,
    toggleSection,
    toggleInfoGroup,
    toggleConnector,
    toggleCollapse,
    resize
  } = useWorkspaceNav(project?.id ?? 'cosmic-fallback')

  const handleScrape = async (): Promise<void> => {
    if (!project) return
    setScraping(true)
    try {
      if (project.sources && project.sources.length > 0) {
        for (const src of project.sources) {
          await syncSource({ projectId: project.id, sourceId: src.id })
        }
      } else {
        await syncNow(project.id)
      }
    } finally {
      setScraping(false)
    }
  }

  if (!activeProjectSnapshot || !cardView || !cardSummary || !project) {
    return null
  }

  const { identity } = cardView
  const statusFlag: CardHeadFlag | null = cardSummary.status
    ? (STATUS_FLAGS[cardSummary.status] ?? { label: cardSummary.status, tone: 'muted' })
    : null

  const headFlags: CardHeadFlag[] = [
    ...(statusFlag ? [statusFlag] : []),
    ...(cardSummary.needsReply ? [{ label: 'Needs my reply', tone: 'danger' as const }] : []),
    ...(cardSummary.inactive ? [{ label: 'Inactive 24h+', tone: 'muted' as const }] : [])
  ]

  return (
    <ErrorBoundary label="cosmic-workspace-view">
      <div
        className="cosmic-full-workspace"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          width: '100%',
          height: '100%',
          background: 'var(--surface-sunken, #090d16)',
          overflow: 'hidden'
        }}
      >
        <article
          className="ws-shell"
          id={`dash-card-anchor-${cardSummary.projectId}`}
          data-expanded="true"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            borderRadius: 0,
            border: 'none',
            height: '100%'
          }}
        >
          <CardHead
            name={identity.name}
            workspaceName={identity.teamName}
            clientName={identity.clientName}
            profileName={profileName}
            aiBadge={cardView.aiBadge}
            flags={headFlags}
            syncing={activeProjectSnapshot.syncState === 'syncing'}
            onSync={() => void syncNow(project.id)}
            onScrape={() => void handleScrape()}
            scraping={scraping}
            onLogs={() => setLogsOpen(true)}
            onSettings={() => openGroup('settings')}
            onEdit={() => openWizard(project.id)}
            onRemove={() => undefined}
            onToggle={() => undefined}
            pinned={false}
          />

          <div
            className={`ws-body${nav.collapsed ? ' is-collapsed' : ''}`}
            style={{
              '--ws-nav-w': `${nav.width}px`,
              flex: 1,
              overflow: 'hidden'
            } as React.CSSProperties}
          >
            <WorkspaceSidebar
              projectId={project.id}
              sources={project.sources}
              view={cardView}
              nav={nav}
              channels={channelLists}
              onOpenGroup={openGroup}
              onSelect={select}
              onToggleSection={toggleSection}
              onToggleInfoGroup={toggleInfoGroup}
              onToggleConnector={toggleConnector}
              onToggleCollapse={toggleCollapse}
              onResize={resize}
              onOpenAdd={() => setCardAddOpen(true)}
            />
            <WorkspaceContent
              view={cardView}
              summary={cardSummary}
              project={project}
              snapshot={activeProjectSnapshot}
              nav={nav}
              channels={channelLists}
              syncing={activeProjectSnapshot.syncState === 'syncing'}
              onSync={() => void syncNow(project.id)}
              onOpenSettings={() => openGroup('settings')}
              onSelect={select}
            />
            <CardAddModal
              open={cardAddOpen}
              project={project}
              onClose={() => setCardAddOpen(false)}
            />
            <RunLogsModal
              open={logsOpen}
              projectId={project.id}
              projectName={project.name}
              onClose={() => setLogsOpen(false)}
            />
          </div>
        </article>
      </div>
    </ErrorBoundary>
  )
}
