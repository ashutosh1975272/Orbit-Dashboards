import type React from 'react'
import { useEffect, useState } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'
import ProjectCard from './ProjectCard'
import SecretsPanel from './SecretsPanel'

/**
 * Full dashboard page (rendered in main-column when dashboardOpen):
 * grid of client project cards, wide "Sync all", and last-updated header.
 */
export default function DashboardView(): React.ReactElement | null {
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loading = useDashboardStore((s) => s.loading)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const deleteProject = useDashboardStore((s) => s.deleteProject)
  const syncNow = useDashboardStore((s) => s.syncNow)
  const progress = useDashboardStore((s) => s.progress)
  const [secretsOpen, setSecretsOpen] = useState(false)

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  if (loading && !snapshot) {
    return (
      <section className="dash-view" data-testid="dashboard-view">
        <p className="dash-empty">Loading dashboard…</p>
      </section>
    )
  }

  return (
    <section className="dash-view" data-testid="dashboard-view">
      <header className="dash-view-head">
        <h2>Client projects — Slack</h2>
        <div className="dash-view-actions">
          <span className="dash-interval">
            auto-sync: every {snapshot?.syncIntervalSeconds ?? 300}s
            {progress?.syncing ? ` · syncing ${progress.current}/${progress.total}` : ''}
          </span>
          <button type="button" className="dash-sync-all" onClick={() => void syncNow()}>
            {' '}
            ⟳ Sync all
          </button>
          <button type="button" className="dash-subtle" onClick={() => setSecretsOpen(true)}>
            ⚙ Dashboard secrets
          </button>
        </div>
      </header>

      <div className="dash-grid" data-testid="dash-grid">
        {(snapshot?.projects ?? []).map((projectSnapshot, index) => (
          <ProjectCard
            key={projectSnapshot.project.id}
            snapshot={projectSnapshot}
            index={index}
            onDelete={(id) => void deleteProject(id)}
          />
        ))}
        {(snapshot?.projects ?? []).length === 0 ? (
          <p className="dash-empty">
            No projects yet. Open <b>⚙ Dashboard secrets</b> (bottom of the sidebar) to add a
            workspace token / project card.
          </p>
        ) : null}
      </div>

      {secretsOpen ? <SecretsPanel onClose={() => setSecretsOpen(false)} /> : null}
    </section>
  )
}
