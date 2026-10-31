import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'
import { useProfileStore } from '../../hooks/useProfiles'
import { useWorkspaceNav } from '../../hooks/useWorkspaceNav'
import { useSlackChannels } from '../../hooks/useSlackChannels'
import WorkspaceSidebar from './WorkspaceSidebar'
import { CardAddModal } from './CardAddModal'
import { buildCardView } from './card-view'
import { buildConnectorChannelLists } from './workspace-nav'
import type { DashboardTeamWorkspace } from '../../../../shared/dashboard-contract'
import { profileDisplayLabel, isIndividualProfile } from '../../../../shared/types'

interface CosmicSidebarContentProps {
  onAddPlatform: () => void
  onNewProject?: () => void
  onNewProfile?: () => void
  onObserver?: () => void
  onOpenAccountsSettings?: () => void
  onOpenProfilesHub?: () => void
}

export function CosmicSidebarContent({
  onAddPlatform: _onAddPlatform,
  onNewProject: _onNewProject,
  onNewProfile: _onNewProfile,
  onObserver: _onObserver,
  onOpenAccountsSettings: _onOpenAccountsSettings,
  onOpenProfilesHub: _onOpenProfilesHub
}: CosmicSidebarContentProps): React.JSX.Element {
  const cosmicLevel1 = useDashboardStore((s) => s.cosmicLevel1)
  const cosmicSelectedCardId = useDashboardStore((s) => s.cosmicSelectedCardId)
  const setCosmicNavigation = useDashboardStore((s) => s.setCosmicNavigation)
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const profiles = useProfileStore((s) => s.profiles)

  const [cardAddOpen, setCardAddOpen] = useState(false)
  const [teamWorkspace, setTeamWorkspace] = useState<DashboardTeamWorkspace | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)

  // Ensure snapshot and profiles are loaded
  useEffect(() => {
    if (!snapshot) {
      void loadSnapshot().catch(() => undefined)
    }
    if (profiles.length === 0) {
      void useProfileStore.getState().loadProfiles().catch(() => undefined)
    }
  }, [snapshot, loadSnapshot, profiles.length])

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

  // Filter individual / selectable profiles
  const selectableProfiles = useMemo(() => {
    const individual = profiles.filter(isIndividualProfile)
    return individual.length > 0 ? individual : profiles
  }, [profiles])

  // Active projects for the selected profile in Level 1 (excluding completed & removed)
  const activeProfileProjects = useMemo(() => {
    if (!snapshot || !cosmicLevel1 || cosmicLevel1 === 'all' || cosmicLevel1 === 'global') {
      return []
    }
    return snapshot.projects.filter(
      (p) =>
        p.project.profileId === cosmicLevel1 &&
        p.project.workflowStatus !== 'completed' &&
        p.project.workflowStatus !== 'removed'
    )
  }, [snapshot, cosmicLevel1])

  // Selected project snapshot
  const activeProjectSnapshot = useMemo(() => {
    if (!snapshot || !cosmicSelectedCardId) return null
    return snapshot.projects.find((p) => p.project.id === cosmicSelectedCardId) ?? null
  }, [snapshot, cosmicSelectedCardId])

  // When activeProjectSnapshot is present, setup channels and nav
  const project = activeProjectSnapshot?.project
  const cardView = useMemo(() => {
    if (!activeProjectSnapshot) return null
    return buildCardView(activeProjectSnapshot)
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

  const navControl = useWorkspaceNav(project?.id ?? 'cosmic-fallback')

  const handleLevel1Change = useCallback(
    (val: string) => {
      if (val === 'all') {
        setCosmicNavigation('all', null)
      } else if (val === 'global') {
        setCosmicNavigation('global', null)
      } else {
        // Find first active project for this profile if available
        const matchingProjects = (snapshot?.projects ?? []).filter(
          (p) =>
            p.project.profileId === val &&
            p.project.workflowStatus !== 'completed' &&
            p.project.workflowStatus !== 'removed'
        )
        const firstId = matchingProjects[0]?.project.id ?? null
        setCosmicNavigation(val, firstId)
      }
    },
    [snapshot, setCosmicNavigation]
  )

  const handleLevel2Change = useCallback(
    (cardId: string) => {
      setCosmicNavigation(cosmicLevel1, cardId || null)
    },
    [cosmicLevel1, setCosmicNavigation]
  )

  const isProfileSelected = Boolean(
    cosmicLevel1 && cosmicLevel1 !== 'all' && cosmicLevel1 !== 'global'
  )

  return (
    <div
      className="cosmic-sidebar-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      {/* Dropdowns Navigation Container */}
      <div
        className="cosmic-nav-selectors"
        style={{
          padding: '8px 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        {/* Level 1 Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label
            htmlFor="cosmic-level1-select"
            style={{
              fontSize: '10.5px',
              fontWeight: 650,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-faint, #64748b)'
            }}
          >
            Navigation
          </label>
          <select
            id="cosmic-level1-select"
            value={cosmicLevel1}
            onChange={(e) => handleLevel1Change(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '7px',
              background: 'color-mix(in srgb, var(--surface, #1e293b) 90%, black)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">▦ All Projects</option>
            <option value="global">🌐 Global Accounts</option>
            <optgroup label="Profiles">
              {selectableProfiles.map((p) => {
                const label = profileDisplayLabel(p)
                const emailSuffix = p.displayName && p.displayName !== label ? ` (${p.displayName})` : ''
                return (
                  <option key={p.id} value={p.id}>
                    👤 {label}{emailSuffix}
                  </option>
                )
              })}
            </optgroup>
          </select>
        </div>

        {/* Level 2 Selector (Active projects for selected profile) */}
        {isProfileSelected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label
              htmlFor="cosmic-level2-select"
              style={{
                fontSize: '10.5px',
                fontWeight: 650,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-faint, #64748b)'
              }}
            >
              Active Workspace Card
            </label>
            <select
              id="cosmic-level2-select"
              value={cosmicSelectedCardId ?? ''}
              onChange={(e) => handleLevel2Change(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: '7px',
                background: 'color-mix(in srgb, var(--surface, #1e293b) 90%, black)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {activeProfileProjects.length === 0 ? (
                <option value="" disabled>
                  No active projects
                </option>
              ) : (
                activeProfileProjects.map((entry) => (
                  <option key={entry.project.id} value={entry.project.id}>
                    📁 {entry.project.name || entry.project.teamName || 'Project'}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      {/* Main Body of Sidebar in Cosmic mode */}
      <div
        className="cosmic-sidebar-body"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {isProfileSelected && activeProjectSnapshot && cardView && project ? (
          <div
            className="cosmic-card-nav-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0
            }}
          >
            <WorkspaceSidebar
              projectId={project.id}
              sources={project.sources}
              view={cardView}
              nav={navControl.nav}
              channels={channelLists}
              onOpenGroup={navControl.openGroup}
              onSelect={navControl.select}
              onToggleSection={navControl.toggleSection}
              onToggleInfoGroup={navControl.toggleInfoGroup}
              onToggleConnector={navControl.toggleConnector}
              onToggleCollapse={navControl.toggleCollapse}
              onResize={navControl.resize}
              onOpenAdd={() => setCardAddOpen(true)}
            />

            {cardAddOpen && (
              <CardAddModal
                open={cardAddOpen}
                project={project}
                onClose={() => setCardAddOpen(false)}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-faint, #64748b)',
              fontSize: '12.5px',
              lineHeight: 1.5
            }}
          >
            {cosmicLevel1 === 'all' ? (
              <p>Viewing all projects in full-screen view. Select a profile above to manage individual cards.</p>
            ) : cosmicLevel1 === 'global' ? (
              <p>Viewing global accounts workspace. Select a profile or project to expand its card.</p>
            ) : (
              <p>No active project cards found for this profile. Use + Project below to create one.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
