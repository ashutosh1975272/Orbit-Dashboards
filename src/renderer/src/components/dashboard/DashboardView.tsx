import type React from 'react'
import { useEffect, useState } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'
import ProjectCard from './ProjectCard'
import DashboardWizard from './DashboardWizard'
import RecentStrip from './RecentStrip'
import ErrorBoundary from './ErrorBoundary'

/**
 * Dashboard page (v2.4): header → top digest → "Recent" strip (mini cards,
 * most important first) → stacked FULL-WIDTH project cards (one workspace
 * per card) with three-column detail view.
 */
export default function DashboardView(): React.ReactElement | null {
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loading = useDashboardStore((s) => s.loading)
  const error = useDashboardStore((s) => s.error)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const deleteProject = useDashboardStore((s) => s.deleteProject)
  const syncNow = useDashboardStore((s) => s.syncNow)
  const progress = useDashboardStore((s) => s.progress)
  const wizardOpenFor = useDashboardStore((s) => s.wizardOpenFor)
  const openWizard = useDashboardStore((s) => s.openWizard)
  const recent = useDashboardStore((s) => s.recent)
  const loadRecent = useDashboardStore((s) => s.loadRecent)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [viewMode, setViewMode] = useState<'compact' | 'expanded' | 'mixed'>('mixed')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [focusGuideSection, setFocusGuideSection] = useState<Record<string, number>>({})
  const [focusDetailKey, setFocusDetailKey] = useState<
    Record<string, 'needs-reply' | 'blockers' | 'risks'>
  >({})
  const [accordionMode] = useState(false)

  useEffect(() => {
    void loadSnapshot()
    void loadRecent()
    const timer = window.setInterval(() => {
      void loadSnapshot().catch(() => {})
      void loadRecent().catch(() => {})
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [loadSnapshot, loadRecent])

  useEffect(() => {
    // Sync view mode with localStorage on load
    try {
      const saved = localStorage.getItem('orbit.view') as 'compact' | 'expanded' | 'mixed' | null
      if (saved) setViewMode(saved)
    } catch {}
  }, [])

  const focusProject = (projectId: string): void => {
    const el = document.getElementById(`dash-card-anchor-${projectId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('is-flash')
    window.setTimeout(() => el.classList.remove('is-flash'), 1400)
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

  const handleViewChange = (mode: 'compact' | 'expanded' | 'mixed') => {
    setViewMode(mode)
    try { localStorage.setItem('orbit.view', mode) } catch {}
    if (mode === 'compact') setExpandedIds(new Set())
    else if (mode === 'expanded')
      setExpandedIds(new Set((snapshot?.projects ?? []).map((p) => p.project.id)))
  }

  return (
    <ErrorBoundary label="dashboard-view">
      <section
        className="dash-view flex flex-col h-full w-full bg-background-dark text-text-dark p-6 overflow-y-auto"
        data-testid="dashboard-view"
      >
          <header className="page-head">
            <h1>Client projects — Slack</h1>
            <div className="actions">
              <span className="auto-sync">
                <i className="dot" aria-hidden="true"></i>
                auto-sync every {snapshot?.syncIntervalSeconds ?? 300}s
                {progress?.syncing ? ` · syncing ${progress.current}/${progress.total}` : ''}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void syncNow()}
              >
                ⟳ Sync all
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openWizard()}
              >
                + Set up new project
              </button>
            </div>
          </header>

          {digest ? (
            <section className="digest" data-testid="dash-digest">
              <span className="label">DIGEST</span>
              <span>{digest.topPriority}</span>
            </section>
          ) : null}

          <RecentStrip items={recent} onSelect={focusProject} />

          {/* WORKSPACES heading row */}
          <div className="section-head">
            <h2>
              Workspaces
              <span className="count">{snapshot?.projects?.length ?? 0}</span>
            </h2>
            <div className="toolbar">
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setExpandedIds(new Set())}
                >
                  Collapse all
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setExpandedIds(new Set((snapshot?.projects ?? []).map((p) => p.project.id)))
                  }
                >
                  Expand all
                </button>
              </div>
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
            </div>
          </div>

          <div className="dash-grid dash-grid-workspace w-full space-y-6" data-testid="dash-grid">
            {(snapshot?.projects ?? []).map((projectSnapshot, index) => {
              const isExpanded =
                viewMode === 'expanded' ||
                (viewMode === 'mixed' && expandedIds.has(projectSnapshot.project.id))
              return (
                <ErrorBoundary key={projectSnapshot.project.id} label={`card-${index}`}>
                  <ProjectCard
                    snapshot={projectSnapshot}
                    index={index}
                    expanded={isExpanded}
                    initialGuideSection={focusGuideSection[projectSnapshot.project.id]}
                    initialDetailKey={focusDetailKey[projectSnapshot.project.id]}
                    onToggle={() => {
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(projectSnapshot.project.id))
                          next.delete(projectSnapshot.project.id)
                        else {
                          if (accordionMode) next.clear()
                          next.add(projectSnapshot.project.id)
                        }
                        return next
                      })
                      const el = document.getElementById(
                        `dash-card-anchor-${projectSnapshot.project.id}`
                      )
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        el.classList.add('is-flash')
                        setTimeout(() => el.classList.remove('is-flash'), 1400)
                      }
                    }}
                    onDelete={(id) => void deleteProject(id)}
                    onExpandSection={(section) => {
                      const id = projectSnapshot.project.id
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
            {(snapshot?.projects ?? []).length === 0 && (
              <div className="empty-state" data-testid="empty-state">
                <div className="icon" aria-hidden="true">+</div>
                <h3>No project cards yet</h3>
                <p>
                  Click <strong>Set up new project</strong>. A 5-step guide walks you through it:
                  create the Slack app → get the token → channels → card → live sync.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => openWizard()}>
                  + Set up new project
                </button>
              </div>
            )}
          </div>

          {wizardOpenFor ? <DashboardWizard /> : null}
        </section>
      </ErrorBoundary>
    )
  }
