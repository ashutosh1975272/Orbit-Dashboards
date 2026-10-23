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

  useEffect(() => {
    void loadSnapshot()
    void loadRecent()
    const timer = window.setInterval(() => {
      void loadSnapshot().catch(() => {})
      void loadRecent().catch(() => {})
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [loadSnapshot, loadRecent])

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
      <section className="flex flex-col h-full w-full bg-background-dark text-text-dark p-12" data-testid="dashboard-view-error">
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
      <section className="flex flex-col h-full w-full bg-background-dark text-text-dark p-12" data-testid="dashboard-view-error">
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
      <section className="flex flex-col h-full w-full bg-background-dark text-text-dark p-6" data-testid="dashboard-view-loading">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-dark">Loading dashboard…</p>
        </div>
      </section>
    )
  }

  const digest = snapshot?.digest ?? null

  try {
    return (
      <ErrorBoundary label="dashboard-view">
      <section className="dash-view flex flex-col h-full w-full bg-background-dark text-text-dark p-6 overflow-y-auto" data-testid="dashboard-view">
        <header className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <h2 className="text-xl font-semibold">Client projects — Slack</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-dark">
              auto-sync: every {snapshot?.syncIntervalSeconds ?? 300}s
              {progress?.syncing ? ` · syncing ${progress.current}/${progress.total}` : ''}
            </span>
            <button
              type="button"
              className="px-4 py-2 bg-accent text-accent-on rounded-lg font-medium text-sm hover:bg-accent-dim transition-colors min-h-[44px]"
              onClick={() => void syncNow()}
            >
              ⟳ Sync all
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-accent text-accent-on rounded-lg font-medium text-sm hover:bg-accent-dim transition-colors min-h-[44px]"
              onClick={() => openWizard()}
            >
              ＋ Set up new project
            </button>
          </div>
        </header>

        {digest ? (
          <div className="dash-digest flex items-center gap-3 flex-wrap p-4 bg-surface-dark border border-border-dark border-l-3 border-accent rounded-lg mb-5" data-testid="dash-digest">
            <span className="text-xs uppercase tracking-wider text-muted-dark">
              {digest.source === 'ai' ? 'AI digest' : 'digest'}
            </span>
            <span className="text-base font-medium">{digest.topPriority}</span>
            {(digest.needsReply?.length ?? 0) > 0 && (
              <span className="flex gap-2 flex-wrap">
                {(digest.needsReply ?? []).map((w) => (
                  <span key={w} className="px-2 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full text-xs font-medium">
                    ⚠ {w}
                  </span>
                ))}
              </span>
            )}
            {(digest.atRisk?.length ?? 0) > 0 && (
              <span className="flex gap-2 flex-wrap">
                {(digest.atRisk ?? []).map((w) => (
                  <span key={w} className="px-2 py-1 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-medium">
                    {w}
                  </span>
                ))}
              </span>
            )}
          </div>
        ) : null}

        <RecentStrip items={recent} onSelect={focusProject} />

        <div className="dash-grid w-full max-w-7xl mx-auto space-y-6" data-testid="dash-grid">
          {(snapshot?.projects ?? []).map((projectSnapshot, index) => (
            <ErrorBoundary key={projectSnapshot.project.id} label={`card-${index}`}>
              <ProjectCard
                snapshot={projectSnapshot}
                index={index}
                onDelete={(id) => void deleteProject(id)}
              />
            </ErrorBoundary>
          ))}
          {(snapshot?.projects ?? []).length === 0 && (
            <p className="text-muted-dark text-center py-12">
              No project cards yet — click <b>＋ Set up new project</b> above. A 5-step guide walks
              you through: create the Slack app → get the token → channels → card → live sync.
            </p>
          )}
        </div>

        {wizardOpenFor ? <DashboardWizard /> : null}
      </section>
      </ErrorBoundary>
    )
  } catch (err) {
    setRenderError(err instanceof Error ? err : new Error(String(err)))
    return null
  }
}