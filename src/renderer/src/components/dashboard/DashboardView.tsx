import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { DashboardGlobalConfig } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import ProjectCard from './ProjectCard'
import DashboardWizard from './DashboardWizard'
import GlobalSettingsPanel from './GlobalSettingsPanel'
import ErrorBoundary from './ErrorBoundary'

function fmtAge(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function MoreGlyph(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

function GearGlyph(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-2.6-1.5L14 2h-4l-.4 3a7.8 7.8 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.8 7.8 0 0 0 2.6 1.5L10 22h4l.4-3a7.8 7.8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Dashboard page (v2.8): one header, one focus line, then a dense list of
 * project rows. A row expands in place into the full workspace.
 */
export default function DashboardView(): React.ReactElement | null {
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loading = useDashboardStore((s) => s.loading)
  const error = useDashboardStore((s) => s.error)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const applySnapshot = useDashboardStore((s) => s.applySnapshot)
  const applyProgress = useDashboardStore((s) => s.applyProgress)
  const deleteProject = useDashboardStore((s) => s.deleteProject)
  const syncNow = useDashboardStore((s) => s.syncNow)
  const progress = useDashboardStore((s) => s.progress)
  const wizardOpenFor = useDashboardStore((s) => s.wizardOpenFor)
  const openWizard = useDashboardStore((s) => s.openWizard)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [viewMode, setViewMode] = useState<'compact' | 'expanded' | 'mixed'>(() => {
    try {
      const saved = localStorage.getItem('orbit.view') as 'compact' | 'expanded' | 'mixed' | null
      return saved ?? 'mixed'
    } catch {
      return 'mixed'
    }
  })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [focusGuideSection, setFocusGuideSection] = useState<Record<string, number>>({})
  const [focusDetailKey, setFocusDetailKey] = useState<
    Record<string, 'needs-reply' | 'blockers' | 'risks'>
  >({})
  const [settingsTarget, setSettingsTarget] = useState<{
    projectId: string
    nonce: number
  } | null>(null)
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<DashboardGlobalConfig | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accordionMode] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadSnapshot()
    const timer = window.setInterval(() => {
      void loadSnapshot().catch(() => {})
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [loadSnapshot])

  // Main pushes a snapshot the moment a sync finishes; the 60s poll is only a
  // backstop. Progress events also drive the per-card "syncing" state.
  useEffect(() => {
    const offSnapshot = window.api.dashboard.onSnapshotChanged((snapshot) =>
      applySnapshot(snapshot)
    )
    const offProgress = window.api.dashboard.onSyncProgress((payload) => {
      applyProgress(payload)
      if (payload.phase === 'complete' || payload.phase === 'error') {
        window.setTimeout(() => {
          void loadSnapshot().catch(() => {})
        }, 250)
      }
    })
    return () => {
      offSnapshot()
      offProgress()
    }
  }, [applySnapshot, applyProgress, loadSnapshot])

  useEffect(() => {
    let cancelled = false
    void window.api.dashboard
      .getGlobalConfig()
      .then((next) => {
        if (!cancelled) setGlobalConfig(next)
      })
      .catch(() => undefined)
    const off = window.api.dashboard.onConfigChanged((next) => {
      if (!cancelled) setGlobalConfig(next)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const focusProject = (projectId: string): void => {
    const el = document.getElementById(`dash-card-anchor-${projectId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('is-flash')
    window.setTimeout(() => el.classList.remove('is-flash'), 1400)
  }

  /** Drop any chip-driven tab focus so the gear can win. */
  const clearCardFocus = (projectId: string): void => {
    setFocusGuideSection((prev) => {
      if (!(projectId in prev)) return prev
      const next = { ...prev }
      delete next[projectId]
      return next
    })
    setFocusDetailKey((prev) => {
      if (!(projectId in prev)) return prev
      const next = { ...prev }
      delete next[projectId]
      return next
    })
  }

  /** Card-header gear → expand the card and land on its Settings tab. */
  const openProjectSettings = (projectId: string): void => {
    clearCardFocus(projectId)
    setExpandedIds((prev) => new Set(prev).add(projectId))
    setSettingsTarget((prev) => ({ projectId, nonce: (prev?.nonce ?? 0) + 1 }))
    window.setTimeout(() => focusProject(projectId), 140)
  }

  // Render error boundary fallback
  if (renderError) {
    return (
      <section
        className="flex flex-col h-full w-full bg-background-dark text-text-dark p-12"
        data-testid="dashboard-view-error"
      >
        <div className="flex flex-col items-center justify-center h-full text-center">
          <h2 className="text-2xl font-semibold text-red-400 mb-4">Dashboard Error</h2>
          <p className="text-muted-dark mb-6">{renderError.message}</p>
          <button
            type="button"
            className="px-4 py-2 bg-accent text-accent-on rounded-lg font-medium hover:bg-accent-dim"
            onClick={() => {
              setRenderError(null)
              void loadSnapshot()
            }}
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className="flex flex-col h-full w-full bg-background-dark text-text-dark p-12"
        data-testid="dashboard-view-error"
      >
        <div className="flex flex-col items-center justify-center h-full text-center">
          <h2 className="text-2xl font-semibold text-red-400 mb-4">Failed to load dashboard</h2>
          <p className="text-muted-dark mb-6">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-accent text-accent-on rounded-lg font-medium hover:bg-accent-dim"
            onClick={() => void loadSnapshot()}
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (loading && !snapshot) {
    return (
      <section
        className="flex flex-col h-full w-full bg-background-dark text-text-dark p-6"
        data-testid="dashboard-view-loading"
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-dark">Loading dashboard…</p>
        </div>
      </section>
    )
  }

  const digest = snapshot?.digest ?? null
  const projects = snapshot?.projects ?? []
  const lastSync = projects.reduce<string | null>(
    (acc, p) => (p.lastUpdatedAt && (!acc || p.lastUpdatedAt > acc) ? p.lastUpdatedAt : acc),
    null
  )

  const handleViewChange = (mode: 'compact' | 'expanded' | 'mixed'): void => {
    setViewMode(mode)
    try {
      localStorage.setItem('orbit.view', mode)
    } catch {
      // localStorage can be unavailable in hardened sessions; view still changes.
    }
    if (mode === 'compact') setExpandedIds(new Set())
    else if (mode === 'expanded')
      setExpandedIds(new Set((snapshot?.projects ?? []).map((p) => p.project.id)))
  }

  const collapseAll = (): void => {
    setExpandedIds(new Set())
    setMenuOpen(false)
  }

  const expandAll = (): void => {
    setExpandedIds(new Set(projects.map((p) => p.project.id)))
    setMenuOpen(false)
  }

  const setupPending = Boolean(
    globalConfig && (!globalConfig.ourSlack.connected || !globalConfig.nvidia.configured)
  )

  return (
    <ErrorBoundary label="dashboard-view">
      <section className="dash-view" data-testid="dashboard-view">
        <header className="dash-head">
          <div className="dash-head-copy">
            <h1>Client projects</h1>
            <p className="dash-head-sub">
              <span>{projects.length === 1 ? '1 project' : `${projects.length} projects`}</span>
              <span>
                {progress?.syncing
                  ? `Syncing ${progress.current}/${progress.total}`
                  : `Synced ${fmtAge(lastSync)}`}
              </span>
              <span>Every {Math.round((snapshot?.syncIntervalSeconds ?? 300) / 60)} min</span>
            </p>
          </div>

          <div className="dash-head-actions">
            <div className="segmented" role="group" aria-label="View mode">
              {(['compact', 'expanded', 'mixed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-mode={mode}
                  aria-pressed={viewMode === mode}
                  onClick={() => handleViewChange(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div className="dash-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="btn btn-icon"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Dashboard actions"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreGlyph />
              </button>
              {menuOpen ? (
                <div
                  className="dash-menu"
                  role="menu"
                  aria-label="Dashboard actions"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setMenuOpen(false)
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void syncNow()
                      setMenuOpen(false)
                    }}
                  >
                    Sync all now
                  </button>
                  <span className="dash-menu-sep" aria-hidden />
                  <button type="button" role="menuitem" onClick={collapseAll}>
                    Collapse all
                  </button>
                  <button type="button" role="menuitem" onClick={expandAll}>
                    Expand all
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="btn btn-secondary dash-settings-btn"
              data-testid="global-settings-open"
              onClick={() => setGlobalSettingsOpen(true)}
            >
              <GearGlyph />
              Settings
            </button>

            <button type="button" className="btn btn-primary" onClick={() => openWizard()}>
              New project
            </button>
          </div>
        </header>

        {setupPending ? (
          <button
            type="button"
            className="dash-global-pending"
            data-testid="global-setup-pending"
            onClick={() => setGlobalSettingsOpen(true)}
          >
            <span>
              <b>Global setup pending</b> —{' '}
              {!globalConfig?.ourSlack.connected && !globalConfig?.nvidia.configured
                ? 'connect Our Slack and NVIDIA'
                : !globalConfig?.ourSlack.connected
                  ? 'connect Our Slack'
                  : 'add an NVIDIA key'}{' '}
              in Settings. Cards keep their client data; AI and Our Slack stay off until then.
            </span>
            <span aria-hidden>→</span>
          </button>
        ) : null}

        {digest ? (
          <p className="dash-focus" data-testid="dash-digest">
            <span className="dash-focus-label">Across workspaces</span>
            <span>{digest.topPriority}</span>
          </p>
        ) : null}

        <div className="dash-list" data-testid="dash-grid">
          {projects.map((projectSnapshot, index) => {
            const isExpanded =
              viewMode === 'expanded' ||
              (viewMode === 'mixed' && expandedIds.has(projectSnapshot.project.id))
            return (
              <ErrorBoundary key={projectSnapshot.project.id} label={`card-${index}`}>
                <ProjectCard
                  snapshot={projectSnapshot}
                  index={index}
                  expanded={isExpanded}
                  initialTab={
                    settingsTarget?.projectId === projectSnapshot.project.id
                      ? 'settings'
                      : undefined
                  }
                  tabNonce={
                    settingsTarget?.projectId === projectSnapshot.project.id
                      ? settingsTarget.nonce
                      : 0
                  }
                  initialGuideSection={focusGuideSection[projectSnapshot.project.id]}
                  initialDetailKey={focusDetailKey[projectSnapshot.project.id]}
                  onOpenSettings={openProjectSettings}
                  onToggle={() => {
                    const id = projectSnapshot.project.id
                    const willCollapse = expandedIds.has(id)
                    setExpandedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else {
                        if (accordionMode) next.clear()
                        next.add(id)
                      }
                      return next
                    })
                    if (willCollapse) {
                      setSettingsTarget((prev) => (prev?.projectId === id ? null : prev))
                    }
                    const el = document.getElementById(`dash-card-anchor-${id}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      el.classList.add('is-flash')
                      setTimeout(() => el.classList.remove('is-flash'), 1400)
                    }
                  }}
                  onDelete={(id) => void deleteProject(id)}
                  onExpandSection={(section) => {
                    const id = projectSnapshot.project.id
                    setSettingsTarget((prev) => (prev?.projectId === id ? null : prev))
                    if (section === 101) {
                      setFocusDetailKey((prev) => ({ ...prev, [id]: 'needs-reply' }))
                      setFocusGuideSection((prev) => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                      })
                    } else if (section === 102) {
                      setFocusDetailKey((prev) => ({ ...prev, [id]: 'blockers' }))
                      setFocusGuideSection((prev) => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                      })
                    } else if (section === 103) {
                      setFocusDetailKey((prev) => ({ ...prev, [id]: 'risks' }))
                      setFocusGuideSection((prev) => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                      })
                    } else {
                      setFocusGuideSection((prev) => ({ ...prev, [id]: section }))
                      setFocusDetailKey((prev) => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                      })
                    }
                    setExpandedIds((prev) => {
                      const next = new Set(prev)
                      next.add(id)
                      return next
                    })
                  }}
                />
              </ErrorBoundary>
            )
          })}

          {projects.length === 0 && (
            <div className="empty-state" data-testid="empty-state">
              <div className="icon" aria-hidden="true">
                +
              </div>
              <h3>No project cards yet</h3>
              <p>
                Click <strong>New project</strong>. A guided setup walks you through it: create the
                Slack app, get the token, pick channels, then sync.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => openWizard()}>
                New project
              </button>
            </div>
          )}
        </div>

        {wizardOpenFor ? <DashboardWizard /> : null}
        <GlobalSettingsPanel
          open={globalSettingsOpen}
          onClose={() => setGlobalSettingsOpen(false)}
        />
      </section>
    </ErrorBoundary>
  )
}
