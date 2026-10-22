import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DashboardProjectSnapshot,
  InsightHistoryEntryContract
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView } from './card-view'

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
  const project = snapshot.project
  const syncNow = useDashboardStore((s) => s.syncNow)
  const syncingIds = useDashboardStore((s) => s.syncingProjectIds)
  const syncing = syncingIds.includes(project.id)
  const openWizard = useDashboardStore((s) => s.openWizard)

  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
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

  const view = useMemo(() => buildCardView(snapshot, index), [snapshot, index])
  const { identity, centre, detail } = view

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
    <article
      className="dash-card dash-card-wide"
      id={`dash-card-anchor-${project.id}`}
      data-testid={`dash-card-${index}`}
    >
      {/* ================= HEAD ================= */}
      <header className="dash-card-head">
        <div className="dash-card-title">
          <span className="dash-card-index">#{index + 1}</span>
          <h3 title={project.name}>{identity.name}</h3>
          <span className="dash-card-client" title={identity.clientName}>
            {identity.clientName}
          </span>
          <span
            className="dash-card-workspace"
            title="Workspace — one card watches exactly one workspace"
          >
            {identity.teamName}
          </span>
        </div>
        <div className="dash-card-actions">
          <span className="dash-card-ai-badge" title="When the insight was produced">
            {view.aiBadge}
          </span>
          <button
            type="button"
            className="dash-icon-btn"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Insight history over time"
            data-testid="dash-history-toggle"
          >
            {historyOpen ? '▾' : '▸'}
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

      <div className="dash-card-body">
        {/* ================= LEFT: identity & health ================= */}
        <section className="dash-zone dash-zone-identity">
          <div className="dash-zone-head">client</div>
          <div className="dash-identity-client">{identity.clientName}</div>

          <div
            className="dash-progress-row"
            title={identity.progressEvidence}
            aria-label={`Completion ${identity.progress}%`}
          >
            <div className="dash-progress-bar">
              <div className="dash-progress-fill" style={{ width: `${identity.progress}%` }} />
            </div>
            <span className="dash-progress-label">{identity.progress}%</span>
          </div>
          {identity.progressEvidence ? (
            <p className="dash-insight-evidence">{identity.progressEvidence}</p>
          ) : null}

          <div className="dash-identity-mood" title={identity.moodReason} data-testid="dash-mood">
            <span className={`dash-chip ${MOOD_BADGE[identity.mood]}`}>mood: {identity.mood}</span>
            {identity.moodQuote ? (
              <span className="dash-insight-meta"> “{identity.moodQuote}”</span>
            ) : null}
          </div>

          <div className="dash-identity-dates" title={identity.dates.badge}>
            <span className="dash-zone-head">dates</span>
            <div className="dash-dates">
              📅 {identity.dates.startDate ?? '?'} → {identity.dates.endDate ?? '?'}
              <span className="dash-insight-meta"> ({identity.dates.badge})</span>
            </div>
          </div>

          {identity.channels.length > 0 ? (
            <div className="dash-identity-channels">
              <span className="dash-zone-head">channels</span>
              <div className="dash-card-perchannel">
                {identity.channels.map((c) => (
                  <span key={c.channelId} className="dash-chip dash-chip-mini">
                    #{c.channelName}
                    {c.newCount > 0 ? ` +${c.newCount}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ================= CENTRE: what matters ================= */}
        <section className="dash-zone dash-zone-centre">
          <div className="dash-zone-head">
            situation
            {centre.statusChange ? (
              <span className="dash-insight-meta"> · {centre.statusChange}</span>
            ) : null}
          </div>
          {centre.status ? (
            <div className="dash-centre-pills">
              <span
                className={`dash-chip insight-status-${centre.status}`}
                title={centre.statusReason}
              >
                {centre.status}
              </span>
              {centre.needsReply ? (
                <span
                  className="dash-chip insight-needs-reply"
                  title={centre.openQuestions.join('\n')}
                  data-testid="dash-needs-reply"
                >
                  ⚠ needs my reply
                  {centre.urgency !== 'normal' ? ` (${centre.urgency})` : ''}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="dash-centre-pills">
              <span className="dash-chip">
                {PACE_ARROW[snapshot.pace]} {snapshot.pace}
              </span>
            </div>
          )}
          {centre.situationLine ? (
            <p className="dash-insight-situation" data-testid="dash-situation">
              {centre.situationLine}
            </p>
          ) : null}
          {centre.recentLine ? (
            <p className="dash-insight-recent" data-testid="dash-recent-line">
              ↻ just changed: {centre.recentLine}
            </p>
          ) : null}
          {centre.highlights.length > 0 ? (
            <ul className="dash-insight-highlights">
              {centre.highlights.map((h, i) => (
                <li key={i}>
                  <span className="dash-insight-what">{h.what}</span>
                  {h.who ? <span className="dash-insight-meta"> · {h.who}</span> : null}
                  {h.whenIso ? (
                    <span className="dash-insight-meta"> · {fmtTime(h.whenIso)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {centre.lastClientMessage ? (
            <p className="dash-insight-client-msg">
              ✉ {centre.lastClientMessage.who} · {fmtTime(centre.lastClientMessage.whenIso)} — “
              {centre.lastClientMessage.quote}”
            </p>
          ) : (
            <p className="dash-insight-meta">no client message yet</p>
          )}
          {centre.openQuestions.length > 0 ? (
            <ul className="dash-insight-questions">
              {centre.openQuestions.map((q, i) => (
                <li key={i}>? {q}</li>
              ))}
            </ul>
          ) : null}
          {centre.nextStep ? (
            <p className="dash-insight-next" data-testid="dash-next-step">
              → next: {centre.nextStep}
            </p>
          ) : null}
        </section>

        {/* ================= RIGHT: detail ================= */}
        <section className="dash-zone dash-zone-detail">
          <div className="dash-zone-head">blocks &amp; next</div>
          {detail.blockers.length > 0 ? (
            <ul className="dash-insight-blockers">
              {detail.blockers.map((b, i) => (
                <li key={i}>
                  <span className="dash-insight-what">{b.what}</span>
                  {b.owner ? <span className="dash-insight-meta"> · {b.owner}</span> : null}
                  {b.sinceIso ? (
                    <span className="dash-insight-meta"> · {fmtTime(b.sinceIso)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-insight-meta">no blockers</p>
          )}

          {detail.hasMoreDetail ? (
            <>
              <button
                type="button"
                className="dash-insight-more-toggle"
                onClick={() => setMoreOpen((v) => !v)}
              >
                {moreOpen ? '▾ hide detail' : '▸ more detail'}
              </button>
              {moreOpen ? (
                <div className="dash-insight-detail" data-testid="dash-insight-detail">
                  {detail.commitments.length > 0 ? (
                    <div className="dash-insight-detail-block">
                      <b>commitments</b>
                      <ul>
                        {detail.commitments.map((c, i) => (
                          <li key={i}>
                            {c.what}
                            {c.who ? ` · ${c.who}` : ''}
                            {c.dueIso ? ` · due ${fmtTime(c.dueIso)}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {detail.decisions.length > 0 ? (
                    <div className="dash-insight-detail-block">
                      <b>decisions</b>
                      <ul>
                        {detail.decisions.map((d, i) => (
                          <li key={i}>
                            {d.what}
                            {d.who ? ` · ${d.who}` : ''}
                            {d.whenIso ? ` · ${fmtTime(d.whenIso)}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {detail.risks.length > 0 ? (
                    <div className="dash-insight-detail-block">
                      <b>risks</b>
                      <ul>
                        {detail.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {detail.keywords.length > 0 ? (
                    <p className="dash-insight-keywords">
                      {detail.keywords.map((k) => (
                        <span key={k} className="dash-chip dash-chip-mini">
                          {k}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {historyOpen ? (
            <div className="dash-history" data-testid="dash-history">
              {history.length === 0 ? (
                <p className="dash-empty">No history yet — it builds each time insights refresh.</p>
              ) : (
                history.map((entry, i) => (
                  <div key={i} className="dash-history-entry">
                    <span className="dash-history-when">
                      {fmtTime(entry.atIso)} · +{entry.newMessageCount} msgs ·{' '}
                      {entry.previousStatus && entry.previousStatus !== entry.insight.status
                        ? `${entry.previousStatus} → ${entry.insight.status}`
                        : entry.insight.status}{' '}
                      · {entry.insight.progress}%
                      {entry.source === 'heuristic' ? ' · heuristic' : ''}
                    </span>
                    {entry.insight.situationLine ? <p>{entry.insight.situationLine}</p> : null}
                    {entry.insight.highlights.length > 0 ? (
                      <ul>
                        {entry.insight.highlights.map((h, j) => (
                          <li key={j}>{h.what}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}

          <footer className="dash-card-foot">
            <span className="dash-updated">{view.syncedLabel}</span>
          </footer>
        </section>
      </div>

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
