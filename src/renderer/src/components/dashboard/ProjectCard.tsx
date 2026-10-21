import type React from 'react'
import { useMemo, useState } from 'react'
import type { DashboardProjectSnapshot } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  onDelete: (projectId: string) => void
}

function fmtTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
}

const MOOD_BADGE: Record<string, string> = {
  good: 'mood-good',
  neutral: 'mood-neutral',
  tense: 'mood-tense'
}

const PACE_ARROW: Record<string, string> = {
  ahead: '▲',
  'on-track': '●',
  stale: '▼'
}

export default function ProjectCard({
  snapshot,
  index,
  onDelete
}: ProjectCardProps): React.ReactElement {
  void index
  const project = snapshot.project
  const syncNow = useDashboardStore((s) => s.syncNow)
  const syncingIds = useDashboardStore((s) => s.syncingProjectIds)
  const syncing = syncingIds.includes(project.id)

  const [editOpen, setEditOpen] = useState(false)
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [completion, setCompletion] = useState(String(project.manualCompletion ?? ''))

  const channelNames = useMemo(
    () => project.monitors.map((m) => m.channelName).join(', '),
    [project.monitors]
  )

  const saveMeta = async (): Promise<void> => {
    await useDashboardStore.getState().upsertProject({
      ...project,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      manualCompletion:
        completion === '' ? undefined : Math.max(0, Math.min(100, Number(completion)))
    })
    setEditOpen(false)
  }

  return (
    <article className="dash-card" data-testid={`dash-card-${index}`}>
      <header className="dash-card-head">
        <div className="dash-card-title">
          <span className="dash-card-index">#{index + 1}</span>
          <h3>{project.name}</h3>
          <span className="dash-card-client">{project.clientName}</span>
        </div>
        <div className="dash-card-actions">
          <button
            type="button"
            className="dash-sync-btn"
            disabled={syncing}
            onClick={() => void syncNow(project.id)}
            title="Poll Slack now for new messages"
          >
            {syncing ? 'Syncing…' : '⟳ Sync'}
          </button>
          <button
            type="button"
            className="dash-icon-btn"
            onClick={() => {
              setStartDate(project.startDate ?? '')
              setEndDate(project.endDate ?? '')
              setCompletion(
                project.manualCompletion != null ? String(project.manualCompletion) : ''
              )
              setEditOpen(true)
            }}
            title="Dates / completion"
          >
            ✎
          </button>
          <button
            type="button"
            className="dash-icon-btn danger"
            onClick={() => onDelete(project.id)}
            title="Delete project"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="dash-card-meta">
        <span className="dash-chip" title="Workspace + monitored channels">
          {channelNames || 'no channels added'}
        </span>
        <span className="dash-chip">
          {PACE_ARROW[snapshot.pace]} {snapshot.pace}
        </span>
        <span
          className={`dash-chip ${MOOD_BADGE[snapshot.mood.state]}`}
          title={snapshot.mood.signal}
        >
          mood: {snapshot.mood.state}
        </span>
      </div>

      <div className="dash-progress-row">
        <div className="dash-progress-bar" aria-label={`Completion ${snapshot.completion}%`}>
          <div className="dash-progress-fill" style={{ width: `${snapshot.completion}%` }} />
        </div>
        <span className="dash-progress-label">{snapshot.completion}%</span>
        <span className="dash-progress-new">
          {snapshot.newMessageCount > 0 ? `+${snapshot.newMessageCount} new` : 'no new msgs'}
        </span>
      </div>

      <div className="dash-summary">
        {snapshot.summary ? (
          <pre>{snapshot.summary}</pre>
        ) : (
          <p className="dash-empty">Awaiting first sync — hit ⟳ Sync.</p>
        )}
      </div>

      <footer className="dash-card-foot">
        <span className="dash-dates">
          📅 {snapshot.effectiveDates.startDate ?? '?'} → {snapshot.effectiveDates.endDate ?? '?'}
          {project.startDate || project.endDate ? ' (manual)' : ''}
        </span>
        <span className="dash-updated">last updated: {fmtTime(snapshot.lastUpdatedAt)}</span>
      </footer>

      {editOpen ? (
        <div className="settings-backdrop" onClick={() => setEditOpen(false)}>
          <section
            className="settings-panel dash-edit-panel"
            role="dialog"
            aria-label="Edit project schedule"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="settings-header">
              <h3>Edit {project.name}</h3>
            </header>
            <label className="settings-row">
              <p className="settings-hint">Start date (blank = use dates found in chat)</p>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="settings-row">
              <p className="settings-hint">End date / deadline</p>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="settings-row">
              <p className="settings-hint">
                Manually set completion % (0–100, overrides the estimate)
              </p>
              <input
                type="number"
                min={0}
                max={100}
                value={completion}
                onChange={(e) => setCompletion(e.target.value)}
                placeholder="auto"
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="dash-primary" onClick={() => void saveMeta()}>
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  )
}
