/**
 * v2.3 — the "Recent" strip feed.
 *
 * One item per workspace/project, built entirely from local data (the stored
 * messages + the last AI insight) — no extra LLM calls, no Slack calls.
 * Items are ranked by IMPORTANCE (a workspace waiting on the client outranks
 * a quiet one), not by time.
 *
 * HARD RULE: the workspace is always attached to an item, so two workspaces
 * can never be mixed up in the strip.
 */

import type {
  InsightStatus,
  RecentActivity,
  RecentActivityKind
} from '../../shared/dashboard-contract'
import type { DashboardDeltaStore, DashboardStoredMessage } from './delta-store'
import type { MonitorStore } from './monitor-store'
import type { ProjectInsight } from '../../shared/dashboard-contract'
import { compareTs } from './delta-store'
import { isNoise } from './summary-engine'

export interface RecentFeedDeps {
  monitorStore: MonitorStore
  deltaStore: DashboardDeltaStore
  /** last insight per project (status, needsReply, recentLine, statusChange) */
  getLastInsight: (projectId: string) => Promise<ProjectInsight | null>
  /** how many messages arrived with the last sync (activity signal) */
  getNewMessageCount?: (projectId: string) => number
  now?: Date
}

const STATUS_WEIGHT: Record<InsightStatus, number> = {
  blocked: 30,
  'at-risk': 24,
  'waiting-on-client': 20,
  'on-track': 8
}

const QUESTION_WORDS =
  /\?|can we|could you|when will|how about|please|pls|any update|need(s)? (your|some)|confirm|approve|review\b/i
const DECISION_WORDS =
  /\b(decided|agreed|confirmed|approved|final|sign-?off|we will|let's|going with)\b/i
const DELIVERY_WORDS =
  /\b(delivered|sent|shared|uploaded|published|deployed|finished|completed|ready)\b/i
const BLOCKER_WORDS =
  /\b(blocked|stuck|waiting on|need(s)? (your|the) (access|assets|files|credentials|login)|can'?t access|delayed)\b/i

function classify(text: string, isClient: boolean): RecentActivityKind {
  if (BLOCKER_WORDS.test(text)) return 'blocker'
  if (QUESTION_WORDS.test(text)) return isClient ? 'client-question' : 'client-message'
  if (DECISION_WORDS.test(text)) return 'decision'
  if (DELIVERY_WORDS.test(text)) return 'delivery'
  return isClient ? 'client-message' : 'chatter'
}

function oneLineFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 110 ? `${clean.slice(0, 107)}…` : clean
}

/** Importance score: urgency + status + recency + activity − staleness. */
export function scoreActivity(input: {
  needsReply: boolean
  urgency: 'low' | 'normal' | 'high'
  status: InsightStatus
  hoursSince: number
  newMessages: number
  stale: boolean
}): number {
  const urgency = input.needsReply ? 35 : 0
  const highUrgency = input.urgency === 'high' ? 15 : 0
  const status = STATUS_WEIGHT[input.status] ?? 8
  const recency = 20 * Math.exp(-Math.max(0, input.hoursSince) / 12)
  const activity = Math.min(15, Math.max(0, input.newMessages))
  const staleness = input.stale ? -10 : 0
  return urgency + highUrgency + status + recency + activity + staleness
}

export async function buildRecentFeed(deps: RecentFeedDeps): Promise<RecentActivity[]> {
  const now = deps.now ?? new Date()
  const projects = await deps.monitorStore.listProjects()
  const items: RecentActivity[] = []

  for (const project of projects) {
    const insight = await deps.getLastInsight(project.id)
    const status: InsightStatus = insight?.status ?? 'on-track'

    // newest meaningful message of this project (own workspace bucket only)
    let newest: { msg: DashboardStoredMessage; channel: string } | null = null
    for (const monitor of project.monitors) {
      const delta = await deps.deltaStore.load(project.profileId, project.teamId, monitor.channelId)
      for (const msg of delta?.messages ?? []) {
        if (isNoise(msg)) continue
        if (!newest || compareTs(msg.ts, newest.msg.ts) > 0) {
          newest = { msg, channel: monitor.channelName }
        }
      }
    }

    const insightActivity = insight?.recentLine?.trim()
    const text = insightActivity || (newest ? oneLineFrom(newest.msg.text ?? '') : '')
    const ts = newest ? new Date(Number(newest.msg.ts) * 1000).toISOString() : project.createdAt
    const hoursSince = Math.max(0, (now.getTime() - new Date(ts).getTime()) / 3_600_000)
    const newMessages = deps.getNewMessageCount?.(project.id) ?? 0
    const isClient = Boolean(
      insight?.clientAsk.lastClientMessage &&
      insight.clientAsk.lastClientMessage.quote &&
      text.includes(insight.clientAsk.lastClientMessage.quote)
    )

    items.push({
      projectId: project.id,
      projectName: project.name,
      teamName: project.teamName ?? project.teamId,
      channelName: newest?.channel ?? '',
      who: newest?.msg.user ?? '',
      text,
      ts,
      kind: classify(text, isClient),
      needsReply: insight?.clientAsk.needsReply ?? false,
      status,
      score: scoreActivity({
        needsReply: insight?.clientAsk.needsReply ?? false,
        urgency: insight?.clientAsk.urgency ?? 'normal',
        status,
        hoursSince,
        newMessages,
        stale: hoursSince >= 48
      }),
      oneLine: text,
      delta: insight?.statusChange || undefined
    })
  }

  // importance first, newest as the tie-breaker
  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.ts).getTime() - new Date(a.ts).getTime()
  })
  return items
}
