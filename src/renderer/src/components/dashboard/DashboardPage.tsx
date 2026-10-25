import type React from 'react'
import { useEffect, useState } from 'react'
import type {
  DashboardAttentionItem,
  DashboardProject,
  DashboardProjectSnapshot,
  DashboardSource,
  InsightMood,
  InsightStatus
} from '../../../../shared/dashboard-contract'
import type { CardSummary, CardView } from './card-view'
import type { SelectionId } from './workspace-nav'

interface DashboardPageProps {
  view: CardView
  summary: CardSummary
  project: DashboardProject
  snapshot: DashboardProjectSnapshot
  syncing: boolean
  onSync: () => void
  onOpenSettings: () => void
  onSelect: (selection: SelectionId) => void
  /** Hand a question to the project chat. */
  onAskAgent?: (question: string) => void
}

const STATUS_LABEL: Record<InsightStatus, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  blocked: 'Blocked',
  'waiting-on-client': 'Waiting on client'
}
const STATUS_TONE: Record<InsightStatus, string> = {
  'on-track': 'good',
  'at-risk': 'warn',
  blocked: 'danger',
  'waiting-on-client': 'warn'
}
const MOOD_LABEL: Record<InsightMood, string> = {
  good: 'Good',
  neutral: 'Neutral',
  tense: 'Tense'
}
const MOOD_TONE: Record<InsightMood, string> = {
  good: 'good',
  neutral: 'neutral',
  tense: 'danger'
}
const KIND_LABEL: Record<DashboardAttentionItem['kind'], string> = {
  'needs-reply': 'Reply',
  question: 'Question',
  blocker: 'Blocker',
  risk: 'Risk',
  requirement: 'Requirement',
  decision: 'Decision',
  commitment: 'Commitment',
  file: 'File',
  status: 'Status'
}

const ASK_SUGGESTIONS = [
  'Kitna complete hua?',
  'Kaun se blockers hain?',
  'Client ne last kya bola?',
  'Next step kya hai?'
]

function age(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Short age for the waiting sub-line: "16d", "4h", "12m". */
function compactAge(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/** 400ms count-up; instantly final under prefers-reduced-motion. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }): React.ReactElement {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (reducedMotion() || value <= 0) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / 400)
      setShown(Math.round(value * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  // Under reduced motion (or at zero) the final number is rendered directly;
  // no synchronous setState is needed just to settle it.
  const display = reducedMotion() || value <= 0 ? value : shown
  return (
    <span>
      {display}
      {suffix}
    </span>
  )
}

function Ring({ value }: { value: number | null }): React.ReactElement {
  const percent = value === null ? 0 : Math.min(100, Math.max(0, value))
  const radius = 20
  const circumference = 2 * Math.PI * radius
  return (
    <div className="dash-ring" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r={radius} className="dash-ring-track" />
        {value !== null ? (
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="dash-ring-value"
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            transform="rotate(-90 24 24)"
          />
        ) : null}
      </svg>
      <span className="dash-ring-label">{value === null ? '—' : `${percent}%`}</span>
    </div>
  )
}

function MoodSpark({
  points
}: {
  points: Array<{ atIso: string; mood: InsightMood }>
}): React.ReactElement {
  const width = 150
  const height = 40
  const level: Record<InsightMood, number> = { tense: 0, neutral: 1, good: 2 }
  const step = points.length > 1 ? width / (points.length - 1) : width
  const coords = points.map((point, index) => {
    const x = index * step
    const y = height - 6 - (level[point.mood] / 2) * (height - 12)
    return `${x},${y}`
  })
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="dash-spark"
      role="img"
      aria-label="Client mood trend"
    >
      <polyline points={coords.join(' ')} className="dash-spark-line" />
      {coords.map((coord, index) => {
        const [x, y] = coord.split(',')
        return <circle key={index} cx={x} cy={y} r="2" className="dash-spark-dot" />
      })}
    </svg>
  )
}

function FreshnessLine({
  lastUpdatedAt,
  syncState,
  busy,
  onOpen,
  onSync
}: {
  lastUpdatedAt: string | null
  syncState: 'idle' | 'syncing' | 'error'
  busy: boolean
  onOpen: () => void
  onSync: () => void
}): React.ReactElement {
  const [nextRunAt, setNextRunAt] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    window.api.dashboard
      .getSchedules()
      .then((state) => {
        if (!alive) return
        setEnabled(state.settings.slackSync.enabled)
        setNextRunAt(state.nextRunAt)
      })
      .catch(() => undefined)
    const off = window.api.dashboard.onSchedulesChanged((state) => {
      if (!alive) return
      setEnabled(state.settings.slackSync.enabled)
      setNextRunAt(state.nextRunAt)
    })
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      alive = false
      off()
      window.clearInterval(tick)
    }
  }, [])

  const seconds = nextRunAt ? Math.ceil((new Date(nextRunAt).getTime() - now) / 1000) : null
  const countdown =
    seconds === null
      ? null
      : seconds <= 0
        ? 'any moment'
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
          : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`

  return (
    <div className="dash-fresh">
      <button
        type="button"
        className="dash-fresh-main"
        onClick={onOpen}
        title="Open schedules"
        data-testid="dash-freshness"
      >
        <span className={`dash-fresh-dot${busy ? ' is-live' : ''}`} aria-hidden="true" />
        {busy ? (
          <span>Syncing now…</span>
        ) : lastUpdatedAt ? (
          <span>Updated {age(lastUpdatedAt)}</span>
        ) : (
          <span>No sync yet</span>
        )}
        <span className="dash-fresh-sep">·</span>
        <span className="dash-fresh-muted">
          {syncState === 'error'
            ? 'sync needs attention'
            : enabled === false
              ? 'sync paused'
              : countdown
                ? `next sync in ${countdown}`
                : 'auto-sync on'}
        </span>
      </button>
      <button
        type="button"
        className="dash-fresh-sync"
        onClick={onSync}
        disabled={busy}
        title="Sync this project now"
      >
        {busy ? 'Syncing…' : 'Sync'}
      </button>
    </div>
  )
}

function SourceChip({ source }: { source: DashboardSource }): React.ReactElement {
  return (
    <span className={`dash-source ${source === 'ours' ? 'is-ours' : 'is-client'}`}>
      {source === 'ours' ? 'Our Slack' : 'Client Slack'}
    </span>
  )
}

export default function DashboardPage({
  view,
  summary,
  project,
  snapshot,
  syncing,
  onSync,
  onOpenSettings,
  onSelect,
  onAskAgent
}: DashboardPageProps): React.ReactElement {
  const { centre, leftSidebar, rightSidebar } = view
  const [askDraft, setAskDraft] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const insight = snapshot.insight ?? null
  const hasInsight = Boolean(insight)
  const metrics = snapshot.metrics
  const busy = syncing || snapshot.syncState === 'syncing'

  useEffect(() => {
    if (!onAskAgent) return
    let alive = true
    const refresh = (): void => {
      window.api.dashboard
        .getProjectChatStatus(summary.projectId)
        .then((status) => {
          if (alive) setHasKey(status.hasKey)
        })
        .catch(() => undefined)
    }
    refresh()
    const off = window.api.dashboard.onConfigChanged(refresh)
    return () => {
      alive = false
      off()
    }
  }, [onAskAgent, summary.projectId])

  const askDisabled = hasKey === false
  const submitQuestion = (question: string): void => {
    const text = question.trim()
    if (!text || askDisabled) return
    setAskDraft('')
    onAskAgent?.(text)
  }

  const manual = typeof project.manualCompletion === 'number'
  const evidence = insight?.progressEvidence?.trim() ?? ''
  const estimate = !manual && insight && evidence ? Math.round(insight.progress) : null
  const progressValue = manual ? (project.manualCompletion ?? 0) : estimate
  const progressLabel = manual
    ? 'set by you'
    : estimate !== null
      ? 'agent estimate'
      : 'not stated in chat'

  const time = centre.visuals.timeElapsed
  const waiting = metrics?.waiting
  const response = metrics?.ourResponse
  const lastContact = metrics?.lastClientContactAt ?? summary.lastClientAt
  const mood = rightSidebar.moodSignals
  const moodKnown = hasInsight && Boolean(mood.moodReason || mood.moodQuote)
  const trend = metrics?.moodTrend ?? []
  const attention = waiting?.items ?? []
  const newSince = metrics?.newSince
  const newTotal = newSince ? Object.values(newSince.counts).reduce((sum, n) => sum + n, 0) : 0

  const requirements = leftSidebar.requirements
  const latestRequirements = requirements.slice(-3)
  const deliverables = leftSidebar.scopeDeliverables.deliverables
  const deliverableCounts = {
    done: deliverables.filter((d) => d.status === 'done').length,
    'in-progress': deliverables.filter((d) => d.status === 'in-progress').length,
    pending: deliverables.filter((d) => d.status === 'pending').length,
    'not-started': deliverables.filter((d) => d.status === 'not-started').length
  }

  const errorLine =
    snapshot.ourWorkspaceError ||
    (snapshot.syncState === 'error'
      ? 'The last sync failed. Showing the last data that arrived.'
      : null)

  const maxDay = Math.max(1, ...(metrics?.daily.map((d) => d.client + d.ours) ?? [0]))

  return (
    <div className="dash-page">
      <div className="dash-scroll">
        <div className="dash-inner">
          <div className="dash-top">
            <FreshnessLine
              lastUpdatedAt={snapshot.lastUpdatedAt}
              syncState={snapshot.syncState}
              busy={busy}
              onOpen={() => onSelect('m:schedules')}
              onSync={onSync}
            />
            {errorLine ? <p className="dash-error">{errorLine}</p> : null}

            {onAskAgent ? (
              <div className="dash-ask">
                <form
                  className="dash-ask-agent"
                  onSubmit={(event) => {
                    event.preventDefault()
                    submitQuestion(askDraft)
                  }}
                >
                  <input
                    type="text"
                    value={askDraft}
                    onChange={(event) => setAskDraft(event.target.value)}
                    placeholder={
                      askDisabled ? 'Add an AI key to ask about this project' : 'Ask agent…'
                    }
                    aria-label="Ask agent about this project"
                    disabled={askDisabled}
                  />
                  <button type="submit" disabled={askDisabled || !askDraft.trim()}>
                    Ask
                  </button>
                </form>
                {askDisabled ? (
                  <p className="dash-muted dash-ask-hint">
                    No AI key yet.{' '}
                    <button type="button" className="dash-link" onClick={onOpenSettings}>
                      Open settings
                    </button>{' '}
                    to add one.
                  </p>
                ) : (
                  <div className="dash-ask-chips">
                    {ASK_SUGGESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className="dash-chip-btn"
                        onClick={() => submitQuestion(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <section className="dash-kpis" aria-label="Key numbers">
            <div className="dash-tile">
              <div className="dash-tile-head">
                <span>Progress</span>
              </div>
              <div className="dash-tile-row">
                <Ring value={progressValue} />
                <div>
                  <p className={`dash-kpi-value${progressValue === null ? ' is-soft' : ''}`}>
                    {progressValue === null ? '—' : `${progressValue}%`}
                  </p>
                  <p className="dash-muted">{progressLabel}</p>
                </div>
              </div>
            </div>

            <div className="dash-tile">
              <div className="dash-tile-head">
                <span>Status</span>
              </div>
              {summary.status ? (
                <>
                  <p className={`dash-chip is-${STATUS_TONE[summary.status]}`}>
                    {STATUS_LABEL[summary.status]}
                  </p>
                  <p className="dash-muted">
                    {metrics?.statusSince
                      ? `since ${shortDate(metrics.statusSince)}`
                      : 'no change logged'}
                  </p>
                </>
              ) : (
                <>
                  <p className="dash-kpi-value is-soft">—</p>
                  <p className="dash-muted">Not analysed yet</p>
                </>
              )}
            </div>

            <div className={`dash-tile${summary.needsReply ? ' is-attention' : ''}`}>
              <div className="dash-tile-head">
                <span>Waiting on you</span>
              </div>
              {!hasInsight ? (
                <>
                  <p className="dash-kpi-value is-soft">—</p>
                  <p className="dash-muted">Not analysed yet</p>
                </>
              ) : (
                <>
                  <p className="dash-kpi-value">
                    <CountUp value={waiting?.count ?? 0} />
                  </p>
                  <p className="dash-muted">
                    {waiting?.oldestIso
                      ? `Oldest: ${compactAge(waiting.oldestIso)}`
                      : 'Age unknown'}
                  </p>
                  {waiting && waiting.blockers + waiting.risks > 0 ? (
                    <p className="dash-muted">
                      {[
                        waiting.blockers
                          ? `${waiting.blockers} blocker${waiting.blockers === 1 ? '' : 's'}`
                          : '',
                        waiting.risks
                          ? `${waiting.risks} risk${waiting.risks === 1 ? '' : 's'}`
                          : ''
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="dash-tile">
              <div className="dash-tile-head">
                <span>Client mood</span>
              </div>
              {moodKnown ? (
                <>
                  <p className={`dash-chip is-${MOOD_TONE[mood.mood]}`}>{MOOD_LABEL[mood.mood]}</p>
                  <p className="dash-muted dash-clip">{mood.moodReason}</p>
                </>
              ) : (
                <>
                  <p className="dash-kpi-value is-soft">—</p>
                  <p className="dash-muted">Not enough signals</p>
                </>
              )}
            </div>

            <div className="dash-tile">
              <div className="dash-tile-head">
                <span>Our response time</span>
              </div>
              <p className={`dash-kpi-value${response?.medianSeconds == null ? ' is-soft' : ''}`}>
                {duration(response?.medianSeconds ?? null)}
              </p>
              <p className="dash-muted">
                {response && response.medianSeconds !== null
                  ? `median · ${response.pairs} replies / ${response.windowDays}d`
                  : 'Needs 3+ replies to measure'}
              </p>
            </div>

            <div className="dash-tile">
              <div className="dash-tile-head">
                <span>Last client contact</span>
              </div>
              <p className={`dash-kpi-value${lastContact ? '' : ' is-soft'}`}>
                {lastContact ? age(lastContact) : '—'}
              </p>
              <p className="dash-muted">
                {lastContact ? shortDate(lastContact) : 'No message yet'}
              </p>
            </div>
          </section>

          <div className="dash-columns">
            <div className="dash-main">
              <section className="dash-hero" aria-label="Situation">
                <p className="dash-hero-eyebrow">Where it stands</p>
                <p className={`dash-hero-line${centre.situationLine ? '' : ' is-soft'}`}>
                  {centre.situationLine ||
                    (hasInsight ? 'No situation line yet.' : 'Not analysed yet.')}
                </p>
                {centre.recentLine ? (
                  <p className="dash-hero-changed">
                    <span>Just changed</span> {centre.recentLine}
                  </p>
                ) : null}
                {centre.nextStep ? (
                  <p className="dash-next">
                    <span>Next step</span> {centre.nextStep}
                  </p>
                ) : null}
              </section>

              <section className="dash-visuals" aria-label="Activity, pace and mood">
                <div className="dash-panel">
                  <div className="dash-panel-head">
                    <h5>Activity</h5>
                    <span className="dash-muted">14 days</span>
                  </div>
                  {metrics && metrics.daily.some((d) => d.client + d.ours > 0) ? (
                    <>
                      <div className="dash-bars" aria-hidden="true">
                        {metrics.daily.map((day) => {
                          const total = day.client + day.ours
                          const height =
                            total === 0 ? 2 : Math.max(4, Math.round((total / maxDay) * 56))
                          return (
                            <div
                              key={day.date}
                              className={`dash-bar${day.isToday ? ' is-today' : ''}${total === 0 ? ' is-empty' : ''}`}
                              title={`${day.date}: ${day.client} client, ${day.ours} ours`}
                            >
                              <div style={{ height }} className="dash-bar-stack">
                                {total > 0 ? (
                                  <>
                                    <div
                                      className="dash-bar-ours"
                                      style={{ flexGrow: day.ours || 0 }}
                                    />
                                    <div
                                      className="dash-bar-client"
                                      style={{ flexGrow: day.client || 0 }}
                                    />
                                  </>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="dash-legend">
                        <span className="dash-legend-client">Client</span>
                        <span className="dash-legend-ours">Ours</span>
                        <span className="dash-legend-total">
                          {metrics.messages24h.client + metrics.messages24h.ours} in 24h
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="dash-muted">No messages in the last 14 days.</p>
                  )}
                </div>

                <div className="dash-panel">
                  <div className="dash-panel-head">
                    <h5>Time and pace</h5>
                    {time.hasDates && time.daysLeft !== undefined ? (
                      <span className="dash-muted">{time.daysLeft}d left</span>
                    ) : null}
                  </div>
                  {time.hasDates ? (
                    <>
                      <p className="dash-pace-line">
                        <b>{time.daysUsed}</b> of <b>{time.totalDays}</b> days used
                      </p>
                      <div className="dash-track" aria-hidden="true">
                        <div
                          className={`dash-track-fill is-${time.pace}`}
                          style={{ width: `${Math.min(100, time.progressPercent ?? 0)}%` }}
                        />
                      </div>
                      <p className={`dash-pace is-${time.pace}`}>{time.paceLabel}</p>
                      <p className="dash-muted">
                        {shortDate(time.startDate)} → {shortDate(time.endDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="dash-muted">No dates on this project yet.</p>
                      <button type="button" className="dash-link" onClick={onOpenSettings}>
                        Add dates
                      </button>
                    </>
                  )}
                </div>

                <div className="dash-panel">
                  <div className="dash-panel-head">
                    <h5>Mood trend</h5>
                    <span className="dash-muted">
                      {trend.length >= 3 ? `${trend.length} runs` : ''}
                    </span>
                  </div>
                  {trend.length >= 3 ? (
                    <>
                      <MoodSpark points={trend} />
                      <p className="dash-muted">since {shortDate(trend[0]?.atIso)}</p>
                    </>
                  ) : (
                    <p className="dash-muted">Needs 3+ agent runs.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="dash-rail">
              <section className="dash-block" aria-label="Needs your attention">
                <div className="dash-block-head">
                  <h5>Needs your attention</h5>
                  {waiting && waiting.count > 0 ? (
                    <span className="dash-muted">{waiting.count} open</span>
                  ) : null}
                </div>
                {!hasInsight ? (
                  <p className="dash-muted">Not analysed yet.</p>
                ) : attention.length === 0 ? (
                  <p className="dash-muted">Not enough info to tell.</p>
                ) : (
                  <ul className="dash-list">
                    {attention.map((item, index) => (
                      <li className="dash-row" key={`${item.kind}-${index}`}>
                        <span className={`dash-kind is-${item.kind}`}>
                          {KIND_LABEL[item.kind] ?? item.kind}
                        </span>
                        <span className="dash-row-text">{item.text}</span>
                        {item.source ? <SourceChip source={item.source} /> : null}
                        <span className="dash-row-age">{item.atIso ? age(item.atIso) : '—'}</span>
                        {item.channelId ? (
                          <button
                            type="button"
                            className="dash-link"
                            onClick={() => onSelect(`c:client:${item.channelId}` as SelectionId)}
                          >
                            Open
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dash-block" aria-label="New since your last visit">
                <div className="dash-block-head">
                  <h5>New since your last visit</h5>
                </div>
                {!newSince?.lastViewedAt ? (
                  <p className="dash-muted">
                    First visit — new requirements, decisions and questions will show here next
                    time.
                  </p>
                ) : newTotal === 0 ? (
                  <p className="dash-muted">Nothing new since your last visit.</p>
                ) : (
                  <>
                    <div className="dash-counts">
                      {newSince.counts.requirements > 0 ? (
                        <span>{newSince.counts.requirements} requirements</span>
                      ) : null}
                      {newSince.counts.decisions > 0 ? (
                        <span>{newSince.counts.decisions} decisions</span>
                      ) : null}
                      {newSince.counts.commitments > 0 ? (
                        <span>{newSince.counts.commitments} commitments</span>
                      ) : null}
                      {newSince.counts.files > 0 ? (
                        <span>{newSince.counts.files} files</span>
                      ) : null}
                      {newSince.counts.questions > 0 ? (
                        <span>{newSince.counts.questions} questions</span>
                      ) : null}
                      {newSince.counts.statusChanges > 0 ? (
                        <span>{newSince.counts.statusChanges} status changes</span>
                      ) : null}
                    </div>
                    <ul className="dash-list">
                      {newSince.items.map((item, index) => (
                        <li className="dash-row" key={`${item.kind}-${index}`}>
                          <span className={`dash-kind is-${item.kind}`}>
                            {KIND_LABEL[item.kind] ?? item.kind}
                          </span>
                          <span className="dash-row-text">{item.text}</span>
                          {item.atIso ? (
                            <span className="dash-row-age">{age(item.atIso)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="dash-block" aria-label="Client ask">
                <div className="dash-block-head">
                  <h5>Client ask</h5>
                  {requirements.length > 0 ? (
                    <span className="dash-muted">{requirements.length} total</span>
                  ) : null}
                </div>
                {latestRequirements.length === 0 ? (
                  <p className="dash-muted">No requirements stated yet.</p>
                ) : (
                  <ul className="dash-asks">
                    {latestRequirements.map((requirement, index) => (
                      <li key={index}>{requirement.text}</li>
                    ))}
                  </ul>
                )}
                {deliverables.length > 0 ? (
                  <>
                    <div className="dash-seg" aria-hidden="true">
                      {(['done', 'in-progress', 'pending', 'not-started'] as const).map(
                        (status) => (
                          <span
                            key={status}
                            className={`dash-seg-part is-${status}`}
                            style={{ flexGrow: deliverableCounts[status] }}
                          />
                        )
                      )}
                    </div>
                    <div className="dash-legend">
                      <span>{deliverableCounts.done} done</span>
                      <span>{deliverableCounts['in-progress']} in progress</span>
                      <span>{deliverableCounts.pending} pending</span>
                      <span>{deliverableCounts['not-started']} not started</span>
                    </div>
                  </>
                ) : (
                  <p className="dash-muted">No deliverables stated yet.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
