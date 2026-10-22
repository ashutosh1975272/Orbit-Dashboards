/** ProjectInsight prompt + schema (v2.2). Rolling merge: previous insight +
 * only NEW messages → merged insight. Nothing is fabricated; quotes come
 * from chat only. If the model omits a field, previous value carries over. */

import type { NimChatMessage } from './ai-provider'
import type { InsightMood, InsightStatus, ProjectInsight } from '../../shared/dashboard-contract'

export { extractJsonObject } from './ai-provider'
export type { InsightMood, InsightStatus, ProjectInsight }

export interface InsightChatMessageInput {
  ts: string
  who: string
  text: string
  isClient: boolean
}

export interface InsightInput {
  projectName: string
  workspaceName: string
  previous: ProjectInsight | null
  newMessages: InsightChatMessageInput[]
  newCount: number
}

const STATUSES: InsightStatus[] = ['on-track', 'at-risk', 'blocked', 'waiting-on-client']
const MOODS: InsightMood[] = ['good', 'neutral', 'tense']

const BASE_INSIGHT: ProjectInsight = {
  status: 'on-track',
  mood: 'neutral',
  progress: 0,
  progressEvidence: '',
  situationLine: '',
  highlights: [],
  blockers: [],
  nextStep: '',
  dates: {},
  clientAsk: { needsReply: false, lastClientMessage: null }
}

function previousBlock(prev: ProjectInsight | null): string {
  if (!prev) return 'none (first insight)'
  return JSON.stringify(prev)
}

export function buildInsightMessages(input: InsightInput): NimChatMessage[] {
  const lines = input.newMessages
    .slice(-120)
    .map((m) => `[${m.ts}] ${m.who}${m.isClient ? ' (CLIENT)' : ''}: ${m.text}`)
    .join('\n')
  const system = [
    'You are a project analyst reading a Slack client-project channel.',
    'Merge the PREVIOUS INSIGHT with ONLY the NEW messages into an updated insight.',
    'Rules: never invent facts; quotes must be copied from messages; dates only if stated in chat as yyyy-mm-dd.',
    'progress: 0-100 with one-line evidence. status in: on-track|at-risk|blocked|waiting-on-client. mood in: good|neutral|tense.',
    'highlights: max 3 short bullets of what changed. blockers: what is stuck and who owns it.',
    'clientAsk.needsReply: true only if the CLIENT asked a question or awaits an answer.',
    'nextStep: the single most important action for the freelancer.',
    'Reply with ONLY a JSON object:',
    '{"status":"...","mood":"...","progress":0,"progressEvidence":"...","situationLine":"one sentence",',
    '"highlights":["..."],"blockers":["..."],"nextStep":"...",',
    '"dates":{"startDate":"yyyy-mm-dd?","endDate":"yyyy-mm-dd?"},',
    '"clientAsk":{"needsReply":false,"lastClientMessage":{"who":"...","whenIso":"...","quote":"..."}}}'
  ].join(' ')
  const user = [
    `Project: ${input.projectName} (workspace: ${input.workspaceName})`,
    `PREVIOUS INSIGHT: ${previousBlock(input.previous)}`,
    `NEW MESSAGES (${input.newCount}):`,
    lines || '(none)'
  ].join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return out.length ? out.slice(0, 5) : undefined
}

export function asDateOnly(v: unknown): string | undefined {
  const s = asString(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined
}

/** Merge parsed LLM JSON over the previous insight; unknown fields carry over. */
export function mergeInsight(
  parsed: Record<string, unknown> | null,
  previous: ProjectInsight | null
): ProjectInsight {
  const base: ProjectInsight = previous ?? {
    ...BASE_INSIGHT,
    dates: {},
    clientAsk: { needsReply: false, lastClientMessage: null }
  }
  if (!parsed) return base

  const status = asString(parsed.status) as InsightStatus | undefined
  const mood = asString(parsed.mood) as InsightMood | undefined
  const progress =
    typeof parsed.progress === 'number' && parsed.progress >= 0 && parsed.progress <= 100
      ? Math.round(parsed.progress)
      : undefined
  const dates = (parsed.dates ?? {}) as Record<string, unknown>
  const clientAsk = (parsed.clientAsk ?? {}) as Record<string, unknown>
  const lastClient = (clientAsk.lastClientMessage ?? null) as Record<string, unknown> | null

  return {
    status: status && STATUSES.includes(status) ? status : base.status,
    mood: mood && MOODS.includes(mood) ? mood : base.mood,
    progress: progress ?? base.progress,
    progressEvidence: asString(parsed.progressEvidence) ?? base.progressEvidence,
    situationLine: asString(parsed.situationLine) ?? base.situationLine,
    highlights: asStringArray(parsed.highlights) ?? base.highlights,
    blockers: asStringArray(parsed.blockers) ?? base.blockers,
    nextStep: asString(parsed.nextStep) ?? base.nextStep,
    dates: {
      startDate: asDateOnly(dates.startDate) ?? base.dates.startDate,
      endDate: asDateOnly(dates.endDate) ?? base.dates.endDate
    },
    clientAsk: {
      needsReply:
        typeof clientAsk.needsReply === 'boolean'
          ? clientAsk.needsReply
          : base.clientAsk.needsReply,
      lastClientMessage:
        lastClient && asString(lastClient.quote)
          ? {
              who: asString(lastClient.who) ?? 'client',
              whenIso: asString(lastClient.whenIso) ?? new Date(0).toISOString(),
              quote: asString(lastClient.quote) as string
            }
          : base.clientAsk.lastClientMessage
    }
  }
}
