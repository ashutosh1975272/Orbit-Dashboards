/** Card view-model (v2.3): the single place that decides what a dashboard card
 * shows, split into the three zones of the full-width card.
 * The LLM insight wins over the local heuristics; the heuristics are the
 * fallback so a card never goes blank. Pure + DOM-free so it can be tested. */

import type {
  DashboardProjectSnapshot,
  InsightBlocker,
  InsightCommitment,
  InsightDecision,
  InsightHighlight,
  InsightMood,
  InsightStatus,
  InsightUrgency
} from '../../../../shared/dashboard-contract'

export interface CardDates {
  startDate?: string
  endDate?: string
  /** 'from chat' | 'manual' | 'not stated in chat' */
  badge: 'from chat' | 'manual' | 'not stated in chat'
}

export interface CardIdentity {
  index: number
  name: string
  clientName: string
  /** workspace name — ALWAYS shown (one card = one workspace) */
  teamName: string
  progress: number
  progressEvidence: string
  mood: InsightMood
  moodReason: string
  moodQuote: string
  dates: CardDates
  channels: Array<{ channelId: string; channelName: string; newCount: number; total: number }>
}

export interface CardCentre {
  status: InsightStatus | null
  statusReason: string
  statusChange: string
  situationLine: string
  /** the single most important thing that just changed */
  recentLine: string
  highlights: InsightHighlight[]
  lastClientMessage: { who: string; whenIso: string; quote: string } | null
  needsReply: boolean
  urgency: InsightUrgency
  openQuestions: string[]
  nextStep: string
}

export interface CardDetail {
  blockers: InsightBlocker[]
  commitments: InsightCommitment[]
  decisions: InsightDecision[]
  risks: string[]
  keywords: string[]
  hasMoreDetail: boolean
}

export interface CardView {
  identity: CardIdentity
  centre: CardCentre
  detail: CardDetail
  /** AI badge text (model + age) or the heuristic label */
  aiBadge: string
  syncedLabel: string
}

function fmtAge(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function buildCardView(snapshot: DashboardProjectSnapshot, index = 0): CardView {
  const insight = snapshot.insight ?? null
  const project = snapshot.project

  const dates: CardDates = insight
    ? insight.dates.startDate || insight.dates.endDate
      ? {
          startDate: insight.dates.startDate ?? snapshot.effectiveDates.startDate,
          endDate: insight.dates.endDate ?? snapshot.effectiveDates.endDate,
          badge: 'from chat'
        }
      : {
          startDate: snapshot.effectiveDates.startDate,
          endDate: snapshot.effectiveDates.endDate,
          badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat'
        }
    : {
        startDate: snapshot.effectiveDates.startDate,
        endDate: snapshot.effectiveDates.endDate,
        badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat'
      }

  const channels = snapshot.perChannel.map((c) => ({
    channelId: c.channelId,
    channelName: c.channelName,
    newCount: c.newMessageCount ?? 0,
    total: c.messageCount
  }))

  const hasMoreDetail = Boolean(
    insight &&
    (insight.moodReason ||
      insight.moodQuote ||
      insight.commitments.length > 0 ||
      insight.decisions.length > 0 ||
      insight.risks.length > 0 ||
      insight.dates.evidence ||
      insight.keywords.length > 0)
  )

  const aiBadge = snapshot.insightUpdatedAt
    ? `${snapshot.insightSource === 'heuristic' ? 'heuristic' : 'AI'} · ${fmtAge(snapshot.insightUpdatedAt)}${
        snapshot.insightModel ? ` · ${snapshot.insightModel}` : ''
      }`
    : 'no insight yet'

  return {
    identity: {
      index,
      name: project.name,
      clientName: project.clientName || project.teamName || '—',
      teamName: project.teamName ?? project.teamId,
      progress: insight ? insight.progress : snapshot.completion,
      progressEvidence: insight ? insight.progressEvidence : snapshot.mood.signal,
      mood: insight ? insight.mood : snapshot.mood.state,
      moodReason: insight ? insight.moodReason : snapshot.mood.signal,
      moodQuote: insight ? insight.moodQuote : '',
      dates,
      channels
    },
    centre: {
      status: insight ? insight.status : null,
      statusReason: insight ? insight.statusReason : '',
      statusChange: insight ? insight.statusChange : '',
      situationLine: insight
        ? insight.situationLine
        : (snapshot.summary.split('\n').find((l) => l.trim()) ?? ''),
      recentLine: insight ? insight.recentLine : '',
      highlights: insight ? insight.highlights : [],
      lastClientMessage: insight ? insight.clientAsk.lastClientMessage : null,
      needsReply: insight ? insight.clientAsk.needsReply : false,
      urgency: insight ? insight.clientAsk.urgency : 'normal',
      openQuestions: insight ? insight.clientAsk.openQuestions : [],
      nextStep: insight ? insight.nextStep : ''
    },
    detail: {
      blockers: insight ? insight.blockers : [],
      commitments: insight ? insight.commitments : [],
      decisions: insight ? insight.decisions : [],
      risks: insight ? insight.risks : [],
      keywords: insight ? insight.keywords : [],
      hasMoreDetail
    },
    aiBadge,
    syncedLabel: `synced ${fmtAge(snapshot.lastUpdatedAt)}`
  }
}
