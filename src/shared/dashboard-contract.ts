/**
 * Dashboard feature contract — additive, no impact on existing channels.
 * See docs/adr/0007-dashboard-module.md and docs/tickets/dashboard-v2.md.
 */
import type { AppId } from './types'

export type DashboardAppId = 'slack'
export type DashboardTokenSource = 'oauth' | 'manual'
export type DashboardMood = 'good' | 'neutral' | 'tense'
export type DashboardSyncState = 'idle' | 'syncing' | 'error'

export interface DashboardMonitor {
  /** Monitored Slack channel (public channel, private group, or mpim). */
  channelId: string
  channelName: string
}

export interface DashboardProject {
  id: string
  /** Display name, e.g. "Acme redesign". */
  name: string
  /** Client person/company shown on the card. */
  clientName: string
  profileId: string
  teamId: string
  /** Slack app the project reads from (Phase 1: slack only). */
  appId: DashboardAppId
  tokenSource: DashboardTokenSource
  /** Used when tokenSource = manual (vault key, not raw token). */
  manualTokenKey?: string
  /** Workspace display name (v2.2) — stamped at create, drives card header. */
  teamName?: string
  monitors: DashboardMonitor[]
  /** User-set dates (ISO yyyy-mm-dd) — win over extractedDates. */
  startDate?: string
  endDate?: string
  /** User-set completion 0–100 — wins over auto estimate. */
  manualCompletion?: number
  createdAt: string
}

export interface DashboardChannelDelta {
  channelId: string
  channelName: string
  messageCount: number
  /** New messages added by the latest sync (tiny +N chip on the card). */
  newMessageCount?: number
  /** ISO of newest stored message. */
  latestMessageAt: string
  /** Slack ts cursor of newest stored message. */
  cursor: string
  lastSyncAt: string
}

export interface DashboardProjectSnapshot {
  project: DashboardProject
  /** 1-line summary of latest activity (latest messages distilled locally). */
  summary: string
  newMessageCount: number
  totalMessageCount: number
  /** 0–100 completion: manual if set, else activity estimate. */
  completion: number
  /** Derived pace hint: 'ahead' | 'on-track' | 'stale'. */
  pace: 'ahead' | 'on-track' | 'stale'
  mood: { state: DashboardMood; signal: string }
  /** Dates found in messages (heuristic) — manual project dates win. */
  extractedDates: { startDate?: string; endDate?: string }
  effectiveDates: { startDate?: string; endDate?: string }
  perChannel: DashboardChannelDelta[]
  /** ISO of the last successful sync covering this project. */
  lastUpdatedAt: string | null
  syncState: DashboardSyncState
  /** v2.2 NVIDIA NIM rolling insight (undefined/null = not generated yet). */
  insight?: ProjectInsight | null
  insightUpdatedAt?: string | null
  insightModel?: string | null
  /** 'ai' = NVIDIA NIM, 'heuristic' = local fallback. */
  insightSource?: 'ai' | 'heuristic' | null
  newSinceLastInsight?: number
}

export interface DashboardManualToken {
  /** Vault key, e.g. "DASH_TOKEN_ACME". */
  key: string
  /** Workspace info if token already validated. */
  teamName?: string
  teamId?: string
  scopes?: string[]
  validated: boolean
  valid?: boolean
}

export interface DashboardSnapshot {
  projects: DashboardProjectSnapshot[]
  manualTokens: DashboardManualToken[]
  syncIntervalSeconds: number
}

export type DashboardSyncProgressPayload = {
  projectIds: Array<string>
  syncing: boolean
  current: number
  total: number
  projectId: string | null
  phase: 'idle' | 'syncing' | 'complete' | 'error'
  message?: string
}

export interface DashboardListChannelsPayload {
  tokenSource: 'oauth' | 'manual'
  profileId?: string
  teamId?: string
  manualTokenKey?: string
}

export interface SyncNowPayload {
  projectId?: string
}

export interface ProjectUpsertPayload {
  project:
    | Omit<DashboardProject, 'id' | 'createdAt'>
    | (Omit<DashboardProject, 'createdAt'> & { id: string })
}

export interface ProjectDeletePayload {
  projectId: string
}

export interface ManualTokenPayload {
  key: string
  token: string
}

export interface DashboardViewSetPayload {
  /** When true renderer shows dashboard view (native embed hidden). */
  open: boolean
  appId?: AppId | null
}

export interface ValidateTokenResultPayload extends DashboardManualToken {
  valid: boolean
  error?: string
  /** Slack user (display login) from auth.test — used to prefill client name. */
  userName?: string
}

/** Public app identity so the wizard can render the exact manifest JSON for the user. */
export interface DashboardAppClientConfig {
  clientId: string
  redirectUri: string
}

/* ===== v2.2 — NVIDIA NIM insight engine ===== */
export type InsightStatus = 'on-track' | 'at-risk' | 'blocked' | 'waiting-on-client'
export type InsightMood = 'good' | 'neutral' | 'tense'

export interface InsightClientMessage {
  who: string
  whenIso: string
  quote: string
}

export interface ProjectInsight {
  status: InsightStatus
  mood: InsightMood
  /** 0-100 */
  progress: number
  progressEvidence: string
  situationLine: string
  highlights: string[]
  blockers: string[]
  nextStep: string
  dates: { startDate?: string; endDate?: string }
  clientAsk: { needsReply: boolean; lastClientMessage: InsightClientMessage | null }
}

export interface InsightHistoryEntryContract {
  atIso: string
  newMessageCount: number
  insight: ProjectInsight
  /** Slack ts cursor position this insight covered (delta tracking). */
  cursorAtSummarize?: string
  /** 'ai' = NVIDIA NIM, 'heuristic' = local fallback (no key / API failure). */
  source?: 'ai' | 'heuristic'
}
