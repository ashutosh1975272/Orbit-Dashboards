import type React from 'react'
import { memo } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DashboardProjectSnapshot,
  InsightHistoryEntryContract
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import { buildCardView } from './card-view'
import LeftSidebar from './LeftSidebar'
import CentreVisuals from './CentreVisuals'
import CentreContent from './CentreContent'
import CompactCard from './CompactCard'
import { buildCardSummary } from './card-view'
import RightSidebar from './RightSidebar'

interface ProjectCardProps {
  snapshot: DashboardProjectSnapshot
  index: number
  expanded: boolean
  onToggle: () => void
  onDelete: (projectId: string) => void
  onExpandSection?: (section: number) => void
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

const MOOD_CLASSES: Record<string, string> = {
  good: 'bg-green-500/15 text-green-400 border-green-500/30',
  neutral: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  tense: 'bg-red-500/15 text-red-400 border-red-500/30'
}

function ProjectCardInner({
  snapshot,
  index,
  expanded,
  onToggle,
  onDelete,
  onExpandSection
}: ProjectCardProps): React.ReactElement {
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

  const view = useMemo(() => buildCardView(snapshot, index), [snapshot, index])
  const summary = useMemo(() => buildCardSummary(snapshot, index), [snapshot, index])
  const { identity, leftSidebar, centre, rightSidebar, aiBadge } = view

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

  const timeElapsed = centre.visuals.timeElapsed
  const daysLeft = timeElapsed.daysLeft ?? 0

  if (!expanded) {
    return (
      <CompactCard
        summary={summary}
        expanded={false}
        onToggle={onToggle}
        onExpandSection={onExpandSection}
        onDelete={onDelete}
        onSync={(id) => void syncNow(id)}
        onEdit={() => { setStartDate(project.startDate ?? ''); setEndDate(project.endDate ?? ''); setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : ''); setEditOpen(true) }}
        onSettings={() => openWizard(project.id)}
        syncing={syncing}
      />
    )
  }

  return (
    <article
      className="dash-card dash-card-v24 bg-surface-2-dark border border-border-dark rounded-2xl overflow-hidden shadow-xl"
      id={`dash-card-anchor-${project.id}`}
      data-testid={`dash-card-${index}`}
    >
      {/* ================= HEAD ================= */}
      <header className="p-4 bg-surface-dark border-b border-border-dark flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3 min-w-0">
          <span className="text-xs text-muted-dark/60">#{index + 1}</span>
          <h3 className="text-xl font-semibold truncate max-w-[300px]" title={project.name}>
            {identity.name}
          </h3>
          <span className="text-sm text-muted-dark truncate max-w-[200px]" title={identity.clientName}>
            {identity.clientName}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent border border-accent/30 whitespace-nowrap flex-shrink-0"
            title="Workspace — one card watches exactly one workspace"
          >
            {identity.teamName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-dark whitespace-nowrap">{aiBadge}</span>
          <span className={`dash-chip px-2 py-1 rounded-full text-xs font-medium border ${MOOD_CLASSES[identity.mood]}`}>
            mood: {identity.mood}
          </span>
          {centre.needsReply && (
            <span className="dash-chip px-2 py-1 rounded-full text-xs font-semibold border bg-red-500/15 text-red-400 border-red-500/30">
              ⚠ needs my reply
            </span>
          )}
          {timeElapsed.hasDates && daysLeft <= 7 && daysLeft > 0 && (
            <span className="dash-chip px-2 py-1 rounded-full text-xs font-medium border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
              ⏰ {daysLeft}d left
            </span>
          )}
          {!timeElapsed.hasDates && identity.dates.badge === 'not stated in chat' && (
            <span className="dash-chip px-2 py-1 rounded-full text-xs font-medium border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
              Inactive 24h+
            </span>
          )}
          <button
            type="button"
            className="dash-icon-btn w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-accent/10 hover:border-accent transition-colors flex items-center justify-center"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Insight history over time"
            data-testid="dash-history-toggle"
          >
            {historyOpen ? '▾' : '▸'}
          </button>
          <button
            type="button"
            className="dash-icon-btn w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-accent/10 hover:border-accent transition-colors flex items-center justify-center"
            onClick={() => openWizard(project.id)}
            title="Edit workspace / channels"
          >
            ⚙
          </button>
          <button
            type="button"
            className="dash-sync-btn px-4 py-2 rounded-lg bg-accent text-accent-on font-medium text-sm min-h-[44px] hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={syncing}
            onClick={() => void syncNow(project.id)}
            title="Poll Slack now for new messages"
          >
            {syncing ? 'Syncing…' : '⟳ Sync'}
          </button>
          <button
            type="button"
            className="dash-icon-btn w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-accent/10 hover:border-accent transition-colors flex items-center justify-center"
            onClick={() => {
              setStartDate(project.startDate ?? '')
              setEndDate(project.endDate ?? '')
              setCompletion(project.manualCompletion != null ? String(project.manualCompletion) : '')
              setEditOpen(true)
            }}
            title="Dates / completion"
          >
            ✎
          </button>
          <button
            type="button"
            className="dash-icon-btn w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-red-500/15 hover:border-red-500/30 transition-colors flex items-center justify-center"
            onClick={() => onDelete(project.id)}
            title="Delete project"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="dash-card-body-v24 grid grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(240px,320px)] gap-0 min-h-[600px]">
        {/* ================= LEFT SIDEBAR: Project Guide ================= */}
        <LeftSidebar
          data={leftSidebar}
          projectId={project.id}
        />

        {/* ================= CENTRE: Visual Overview + Summary ================= */}
        <section className="dash-zone dash-zone-centre-v24 p-4" data-testid="dash-centre">
          <CentreVisuals visuals={centre.visuals} />
          <CentreContent centre={centre} />
        </section>

        {/* ================= RIGHT SIDEBAR: Attention & Activity ================= */}
        <RightSidebar
          data={rightSidebar}
          projectId={project.id}
        />
      </div>

      {/* History Drawer (bottom) */}
      {historyOpen && (
        <div className="dash-history-drawer absolute bottom-0 left-0 right-0 max-h-[40%] bg-surface-dark border-t border-border-dark rounded-b-2xl flex flex-col z-10 shadow-2xl" data-testid="dash-history-drawer">
          <div className="flex items-center justify-between p-3 border-b border-border-dark">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-dark">Insight History</span>
            <button
              type="button"
              className="dash-icon-btn w-8 h-8 rounded-lg border border-border-dark text-text-dark hover:bg-accent/10 hover:border-accent transition-colors flex items-center justify-center"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close history"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-muted-dark text-center py-8">No history yet — it builds each time insights refresh.</p>
            ) : (
              history.map((entry, i) => (
                <div key={i} className="p-3 bg-surface-2-dark border border-border-dark rounded-lg">
                  <span className="block text-xs font-semibold text-muted-dark mb-2">
                    {fmtTime(entry.atIso)} · +{entry.newMessageCount} msgs ·{' '}
                    {entry.previousStatus && entry.previousStatus !== entry.insight.status
                      ? `${entry.previousStatus} → ${entry.insight.status}`
                      : entry.insight.status}{' '}
                    · {entry.insight.progress}%
                    {entry.source === 'heuristic' ? ' · heuristic' : ''}
                  </span>
                  {entry.insight.situationLine && <p className="text-sm text-text-dark">{entry.insight.situationLine}</p>}
                  {entry.insight.highlights.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-muted-dark mt-2 space-y-1">
                      {entry.insight.highlights.map((h, j) => (
                        <li key={j}>{h.what}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editOpen && (
        <div className="settings-backdrop fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setEditOpen(false)}>
          <section
            className="settings-panel dash-edit-panel bg-surface-dark border border-border-dark rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto"
            role="dialog"
            aria-label="Edit project schedule"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit {project.name}</h3>
            </header>
            <label className="flex flex-col gap-2 mb-4">
              <p className="text-xs text-muted-dark">Start date (blank = use dates found in chat)</p>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2-dark border border-border-dark rounded-lg text-text-dark focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 mb-4">
              <p className="text-xs text-muted-dark">End date / deadline</p>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2-dark border border-border-dark rounded-lg text-text-dark focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 mb-6">
              <p className="text-xs text-muted-dark">
                Manually set completion % (0–100, overrides the estimate)
              </p>
              <input
                type="number"
                min={0}
                max={100}
                value={completion}
                onChange={(e) => setCompletion(e.target.value)}
                placeholder="auto"
                className="w-full px-3 py-2 bg-surface-2-dark border border-border-dark rounded-lg text-text-dark focus:border-accent focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-surface-2-dark border border-border-dark text-text-dark rounded-lg font-medium hover:bg-accent/10 hover:border-accent transition-colors"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-accent text-accent-on rounded-lg font-medium hover:bg-accent-dim transition-colors"
                onClick={() => void saveMeta()}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </article>
  )
}

export default memo(ProjectCardInner, (prev, next) => {
  return prev.snapshot.project.id === next.snapshot.project.id &&
    prev.snapshot.lastUpdatedAt === next.snapshot.lastUpdatedAt &&
    prev.expanded === next.expanded &&
    prev.index === next.index
})
