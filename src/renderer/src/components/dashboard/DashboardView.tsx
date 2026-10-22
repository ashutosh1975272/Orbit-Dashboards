import type React from 'react'
import { useEffect } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'
import ProjectCard from './ProjectCard'
import DashboardWizard from './DashboardWizard'
import RecentStrip from './RecentStrip'

/**
 * Dashboard page (v2.3): header → top digest → "Recent" strip (mini cards,
 * most important first) → stacked FULL-WIDTH project cards (one workspace
 * per card).
 */
export default function DashboardView(): React.ReactElement | null {
  const snapshot = useDashboardStore((s) => s.snapshot)
  const loading = useDashboardStore((s) => s.loading)
  const loadSnapshot = useDashboardStore((s) => s.loadSnapshot)
  const deleteProject = useDashboardStore((s) => s.deleteProject)
  const syncNow = useDashboardStore((s) => s.syncNow)
  const progress = useDashboardStore((s) => s.progress)
  const wizardOpenFor = useDashboardStore((s) => s.wizardOpenFor)
  const openWizard = useDashboardStore((s) => s.openWizard)
  const recent = useDashboardStore((s) => s.recent)
  const loadRecent = useDashboardStore((s) => s.loadRecent)

  useEffect(() => {
    void loadSnapshot()
    void loadRecent()
    // keep the strip and the cards fresh while the dashboard is open
    const timer = window.setInterval(() => {
      void loadSnapshot()
      void loadRecent()
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

  if (loading && !snapshot) {
    return (
      <section className="dash-view" data-testid="dashboard-view">
        <p className="dash-empty">Loading dashboard…</p>
      </section>
    )
  }

  const digest = snapshot?.digest ?? null

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
            ⟳ Sync all
          </button>
          <button type="button" className="dash-primary" onClick={() => openWizard()}>
            ＋ Set up new project
          </button>
        </div>
      </header>

      {digest ? (
        <div className="dash-digest" data-testid="dash-digest">
          <span className="dash-digest-label">
            {digest.source === 'ai' ? 'AI digest' : 'digest'}
          </span>
          <span className="dash-digest-text">{digest.topPriority}</span>
          {digest.needsReply.length > 0 ? (
            <span className="dash-digest-chips">
              {digest.needsReply.map((w) => (
                <span key={w} className="dash-chip insight-needs-reply">
                  ⚠ {w}
                </span>
              ))}
            </span>
          ) : null}
          {digest.atRisk.length > 0 ? (
            <span className="dash-digest-chips">
              {digest.atRisk.map((w) => (
                <span key={w} className="dash-chip insight-status-at-risk">
                  {w}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}

      <RecentStrip items={recent} onSelect={focusProject} />

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
            No project cards yet — click <b>＋ Set up new project</b> above. A 5-step guide walks
            you through: create the Slack app → get the token → channels → card → live sync.
          </p>
        ) : null}
      </div>

      {wizardOpenFor ? <DashboardWizard /> : null}
    </section>
  )
}
