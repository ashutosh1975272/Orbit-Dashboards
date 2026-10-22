import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DashboardProjectSnapshot,
  InsightHistoryEntryContract
} from '../../../../shared/dashboard-contract'
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
  const openWizard = useDashboardStore((s) => s.openWizard)

  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<InsightHistoryEntryContract[]>([])

  useEffect(() => {
    if (!historyOpen) return
    void window.api.dashboard
      .getHistory({ projectId: project.id })
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [historyOpen, project.id])
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [completion, setCompletion] = useState(String(project.manualCompletion ?? ''))

  const channelNames = useMemo(
    () => project.monitors.map((m) => m.channelName).join(', '),
    [project.monitors]
  )

  // v2.2 — the LLM insight wins over the local heuristics when present.
  const insight = snapshot.insight ?? null
  const progress = insight ? insight.progress : snapshot.completion
  const mood = insight ? insight.mood : snapshot.mood.state
  const dates = insight
    ? {
        startDate: insight.dates.startDate ?? snapshot.effectiveDates.startDate,
        endDate: insight.dates.endDate ?? snapshot.effectiveDates.endDate,
        fromChat: Boolean(insight.dates.startDate || insight.dates.endDate)
      }
    : {
        startDate: snapshot.effectiveDates.startDate,
        endDate: snapshot.effectiveDates.endDate,
        fromChat: false
      }

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
          {project.teamName ? (
            <span className="dash-card-workspace">{project.teamName}</span>
          ) : null}
        </div>
        <div className="dash-card-actions">
          <button
            type="button"
            className="dash-icon-btn"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Insight history over time"
          >
            {historyOpen ? '▾' : '▸'} History
          </button>
          <button
            type="button"
            className="dash-icon-btn"
            onClick={() => openWizard(project.id)}
            title="Edit workspace / channels"
          >
            ⚙
          </button>
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
        <span
          className={`dash-chip ${MOOD_BADGE[mood]}`}
          title={insight?.progressEvidence || snapshot.mood.signal}
        >
          mood: {mood}
        </span>
        {insight ? (
          <span className={`dash-chip insight-status-${insight.status}`}>{insight.status}</span>
        ) : (
          <span className="dash-chip">
            {PACE_ARROW[snapshot.pace]} {snapshot.pace}
          </span>
        )}
      </div>

      <div className="dash-progress-row">
        <div className="dash-progress-bar" aria-label={`Completion ${progress}%`}>
          <div className="dash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="dash-progress-label">{progress}%</span>
        <span className="dash-progress-new">
          {snapshot.newMessageCount > 0 ? `+${snapshot.newMessageCount} new` : 'no new msgs'}
        </span>
      </div>

      {insight ? (
        <div className="dash-insight" data-testid="dash-insight">
          <div className="dash-insight-head">
            {insight.clientAsk.needsReply ? (
              <span className="dash-chip insight-needs-reply">⚠ needs my reply</span>
            ) : null}
            {snapshot.insightUpdatedAt ? (
              <span className="dash-insight-updated">
                {snapshot.insightSource === 'heuristic' ? 'heuristic' : 'AI'} ·{' '}
                {fmtTime(snapshot.insightUpdatedAt)}
                {snapshot.insightModel ? ` · ${snapshot.insightModel}` : ''}
              </span>
            ) : null}
          </div>
          {insight.situationLine ? (
            <p className="dash-insight-situation">{insight.situationLine}</p>
          ) : null}
          {insight.highlights.length > 0 ? (
            <ul className="dash-insight-highlights">
              {insight.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
          {insight.clientAsk.lastClientMessage ? (
            <p className="dash-insight-client-msg">
              ✉ {insight.clientAsk.lastClientMessage.who} ·{' '}
              {fmtTime(insight.clientAsk.lastClientMessage.whenIso)} — “
              {insight.clientAsk.lastClientMessage.quote}”
            </p>
          ) : null}
          {insight.nextStep ? (
            <p className="dash-insight-next">→ next: {insight.nextStep}</p>
          ) : null}
          {insight.blockers.length > 0 ? (
            <ul className="dash-insight-blockers">
              {insight.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
          {insight.progressEvidence ? (
            <p className="dash-insight-evidence">{insight.progressEvidence}</p>
          ) : null}
        </div>
      ) : null}

      <div className="dash-summary">
        {snapshot.insight ? null : snapshot.summary ? (
          <pre>{snapshot.summary}</pre>
        ) : (
          <p className="dash-empty">Awaiting first sync — hit ⟳ Sync.</p>
        )}
      </div>

      {historyOpen ? (
        <div className="dash-history" data-testid="dash-history">
          {history.length === 0 ? (
            <p className="dash-empty">No history yet — it builds each time insights refresh.</p>
          ) : (
            history.map((entry, i) => (
              <div key={i} className="dash-history-entry">
                <span className="dash-history-when">
                  {fmtTime(entry.atIso)} · +{entry.newMessageCount} msgs · {entry.insight.status} ·{' '}
                  {entry.insight.progress}%{entry.source === 'heuristic' ? ' · heuristic' : ''}
                </span>
                {entry.insight.situationLine ? <p>{entry.insight.situationLine}</p> : null}
                {entry.insight.highlights.length > 0 ? (
                  <ul>
                    {entry.insight.highlights.map((h, j) => (
                      <li key={j}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      <footer className="dash-card-foot">
        <span className="dash-dates">
          📅 {dates.startDate ?? '?'} → {dates.endDate ?? '?'}
          {dates.fromChat
            ? ' (from chat)'
            : project.startDate || project.endDate
              ? ' (manual)'
              : ''}
        </span>
        <span className="dash-updated">synced {fmtTime(snapshot.lastUpdatedAt)}</span>
      </footer>

      {snapshot.perChannel.length > 1 ? (
        <div className="dash-card-perchannel" title="Messages stored per channel">
          {snapshot.perChannel.map((c) => (
            <span key={c.channelId} className="dash-chip dash-chip-mini">
              #{c.channelName}
              {c.newMessageCount && c.newMessageCount > 0 ? ` +${c.newMessageCount}` : ''}
            </span>
          ))}
        </div>
      ) : null}

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
