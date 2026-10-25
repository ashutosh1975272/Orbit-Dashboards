/**
 * Dashboard feature contract — additive, no impact on existing channels.
 * See docs/adr/0007-dashboard-module.md and docs/tickets/dashboard-v2.md.
 */
import type { AppId } from './types'

export type DashboardAppId = 'slack'
export type DashboardTokenSource = 'oauth' | 'manual'
export type DashboardMood = 'good' | 'neutral' | 'tense'
export type DashboardSyncState = 'idle' | 'syncing' | 'error'

/** Where a stored message came from: the card's client workspace, or our own. */
export type DashboardSource = 'client' | 'ours'

export type DashboardTeamWorkspaceSource = 'oauth' | 'manual' | 'none'

/** One workspace the app can already reach, offered when connecting ours. */
export interface DashboardTeamWorkspaceCandidate {
  profileId: string
  profileName: string
  teamId: string
  teamName: string
  teamDomain: string
  scopes: string[]
}

/** Public view of the one team workspace shared by every card. Never a token. */
export interface DashboardTeamWorkspace {
  connected: boolean
  profileId: string | null
  teamId: string | null
  teamName: string | null
  source: DashboardTeamWorkspaceSource
  /** Mask such as "••••abcd"; null when nothing is connected. */
  maskedToken: string | null
  /** The channels pinned from this workspace onto every card. */
  channels: DashboardMonitor[]
  updatedAt: string | null
}

export interface DashboardTeamWorkspaceConnectPayload {
  source: 'oauth' | 'manual'
  profileId?: string
  teamId?: string
  /** Raw token, only for source = 'manual'. Never returned by main. */
  token?: string
}

export interface DashboardTeamWorkspaceChannelsPayload {
  channels: DashboardMonitor[]
}

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
  /** Slack user id of the token owner (= the freelancer, not the client). */
  selfUserId?: string
  monitors: DashboardMonitor[]
  /** User-set dates (ISO yyyy-mm-dd) — win over extractedDates. */
  startDate?: string
  endDate?: string
  /** User-set completion 0–100 — wins over auto estimate. */
  manualCompletion?: number
  createdAt: string
}

/** One day of message activity, split by workspace. Deterministic, main-process. */
export interface DashboardActivityDay {
  /** yyyy-mm-dd (UTC) */
  date: string
  client: number
  ours: number
  isToday: boolean
}

/** Median first-reply time over the last `windowDays`, or null under 3 pairs. */
export interface DashboardResponseStats {
  medianSeconds: number | null
  pairs: number
  windowDays: number
}

export type DashboardAttentionKind =
  | 'question'
  | 'needs-reply'
  | 'blocker'
  | 'risk'
  | 'requirement'
  | 'decision'
  | 'commitment'
  | 'file'
  | 'status'

/** One row for "Needs your attention" / "New since your last visit". */
export interface DashboardAttentionItem {
  kind: DashboardAttentionKind
  text: string
  atIso?: string
  source?: DashboardSource
  channelId?: string
  ts?: string
  permalink?: string
}

export interface DashboardNewSinceCounts {
  requirements: number
  decisions: number
  commitments: number
  files: number
  statusChanges: number
  questions: number
}

/** Everything the Dashboard page shows that is computed from stored messages. */
export interface DashboardMetrics {
  daily: DashboardActivityDay[]
  messages24h: { client: number; ours: number }
  lastClientContactAt: string | null
  ourResponse: DashboardResponseStats
  waiting: { count: number; oldestIso: string | null; items: DashboardAttentionItem[] }
  statusSince: string | null
  /** Empty until at least 3 runs have been recorded. */
  moodTrend: Array<{ atIso: string; mood: InsightMood }>
  newSince: {
    lastViewedAt: string | null
    counts: DashboardNewSinceCounts
    items: DashboardAttentionItem[]
  }
}

export interface DashboardMarkViewedPayload {
  projectId: string
  atIso?: string
}

export interface DashboardChannelDelta {
  channelId: string
  channelName: string
  /** Which workspace this channel belongs to (absent on rows stored before v3). */
  source?: DashboardSource
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
  /** Set when our team workspace failed while the client workspace synced fine. */
  ourWorkspaceError?: string | null
  /** Deterministic Dashboard-page metrics (absent until the first snapshot build). */
  metrics?: DashboardMetrics
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
  /** v2.3 — one line across all workspaces (each item names its workspace). */
  digest?: DashboardDigest | null
}

/** v2.3 — cross-workspace digest (the ONLY place workspaces are combined). */
export interface DashboardDigest {
  /** ≤20 words — the single most urgent thing across all workspaces. */
  topPriority: string
  /** workspaces whose client is waiting on a reply */
  needsReply: string[]
  /** workspaces that are at risk / blocked */
  atRisk: string[]
  atIso: string
  source: 'ai' | 'local'
}

/** v2.3 — one item per workspace for the "Recent" strip. */
export type RecentActivityKind =
  'client-question' | 'client-message' | 'decision' | 'delivery' | 'blocker' | 'chatter'

export interface RecentActivity {
  projectId: string
  projectName: string
  /** Workspace name — ALWAYS shown so workspaces are never mixed up. */
  teamName: string
  channelName: string
  who: string
  text: string
  /** ISO timestamp of the underlying message */
  ts: string
  kind: RecentActivityKind
  needsReply: boolean
  status: InsightStatus
  /** importance score (higher = more important) */
  score: number
  /** one meaningful sentence (never raw chat noise) */
  oneLine: string
  /** "old → new" when the status changed */
  delta?: string
  /** hours since last message (for inactive filter) */
  hoursSinceLastMessage: number
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
  tokenSource?: 'oauth' | 'manual'
  profileId?: string
  teamId?: string
  manualTokenKey?: string
  /** 'ours' lists the globally connected team workspace instead of a card's. */
  source?: DashboardSource
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
  /** Slack user id of the token owner — used to tell "me" from "the client". */
  userId?: string
}

/** Public app identity so the wizard can render the exact manifest JSON for the user. */
export interface DashboardAppClientConfig {
  clientId: string
  redirectUri: string
}

/* ===== v2.2 — NVIDIA NIM insight engine ===== */
export type InsightStatus = 'on-track' | 'at-risk' | 'blocked' | 'waiting-on-client'
export type InsightMood = 'good' | 'neutral' | 'tense'
export type InsightUrgency = 'low' | 'normal' | 'high'

export interface InsightClientMessage {
  who: string
  whenIso: string
  quote: string
}

/** One thing that happened (evidence-linked). */
export interface InsightHighlight {
  what: string
  who?: string
  whenIso?: string
}

/** Something that is stuck, and who owns it. */
export interface InsightBlocker {
  what: string
  owner?: string
  sinceIso?: string
}

/** A promise made in chat (owner + what). */
export interface InsightCommitment {
  who?: string
  what: string
  dueIso?: string
}

/** An agreed decision in chat. */
export interface InsightDecision {
  what: string
  who?: string
  whenIso?: string
}

export interface ProjectInsight {
  status: InsightStatus
  /** Why that status (≤15 words, evidence based). */
  statusReason: string
  /** "old → new" when the status changed with this refresh (else empty). */
  statusChange: string
  mood: InsightMood
  /** Why that mood (≤12 words). */
  moodReason: string
  /** Verbatim client quote behind the mood (empty when none). */
  moodQuote: string
  /** 0-100 */
  progress: number
  progressEvidence: string
  situationLine: string
  /** ≤12 words — the single most important thing that just changed. */
  recentLine: string
  highlights: InsightHighlight[]
  blockers: InsightBlocker[]
  nextStep: string
  dates: { startDate?: string; endDate?: string; evidence?: string }
  clientAsk: {
    needsReply: boolean
    urgency: InsightUrgency
    lastClientMessage: InsightClientMessage | null
    openQuestions: string[]
  }
  commitments: InsightCommitment[]
  decisions: InsightDecision[]
  risks: string[]
  keywords: string[]

  /* ===== v2.4 — Project Guide & Attention sidebar fields ===== */
  /** Client requirements explicitly stated (source: PDF/DOCX/chat) */
  requirements: InsightRequirement[]
  /** Scope: in-scope and out-of-scope items */
  scope: { in: string[]; out: string[] }
  /** Deliverables with status */
  deliverables: InsightDeliverable[]
  /** Files shared in the workspace */
  files: InsightFile[]
  /** People involved */
  people: InsightPerson[]
  /** Milestones with dates and completion */
  milestones: InsightMilestone[]
}

export interface InsightRequirement {
  text: string
  /** Source file name if from attachment (PDF/DOCX) */
  sourceFile?: string
  /** Who said it */
  who?: string
  /** When (ISO timestamp) */
  whenIso?: string
}

export interface InsightDeliverable {
  name: string
  /** 'done' | 'in-progress' | 'pending' | 'not-started' */
  status: 'done' | 'in-progress' | 'pending' | 'not-started'
}

export interface InsightFile {
  name: string
  /** 'pdf' | 'docx' | 'link' | 'image' | 'other' */
  type: 'pdf' | 'docx' | 'link' | 'image' | 'other'
  who?: string
  whenIso?: string
  url?: string
}

export interface InsightPerson {
  name: string
  role?: string
  /** 'client' | 'us' */
  side: 'client' | 'us'
}

export interface InsightMilestone {
  label: string
  dateIso: string
  done: boolean
}

export interface SidebarState {
  collapsed: boolean
  width: number
  openSection: number | null
}

export interface ProjectSidebarState {
  left: SidebarState
  right: SidebarState
}

export interface DashboardSidebarGetPayload {
  projectId: string
}

export interface DashboardSidebarSetPayload {
  projectId: string
  state: ProjectSidebarState
}

export interface DashboardSidebarUpdatePayload {
  projectId: string
  sidebar: 'left' | 'right'
  patch: Partial<SidebarState>
}

export interface InsightHistoryEntryContract {
  atIso: string
  newMessageCount: number
  insight: ProjectInsight
  /** Slack ts cursor position this insight covered (delta tracking). */
  cursorAtSummarize?: string
  /** 'ai' = NVIDIA NIM, 'heuristic' = local fallback (no key / API failure). */
  source?: 'ai' | 'heuristic'
  /** model that produced this insight (shown on the card) */
  model?: string
  /** Status before this refresh — lets the timeline show "at-risk → on-track". */
  previousStatus?: InsightStatus

  /* v2.4 — sidebar state snapshot at this insight */
  sidebarState?: { left: SidebarState; right: SidebarState }
}

/* ===== v2.6 — Slack Chat tab (local history + replies) ===== */

/** One message in the Slack Chat tab (local delta store, names resolved best-effort). */
export interface DashboardChatMessage {
  /** Slack ts — unique within a channel. Optimistic messages use `temp-…`. */
  ts: string
  channelId: string
  channelName: string
  /** Slack user id (empty when the message has no author, e.g. some bot posts). */
  userId: string
  /** Display name when resolvable; falls back to the user id (ADR-0007). */
  userName: string
  /** Workspace this message came from. */
  source: DashboardSource
  text: string
  /** ISO timestamp derived from ts. */
  atIso: string
  /** true when the token owner wrote the message. */
  isMine: boolean
  /** optimistic message, not confirmed by Slack yet. */
  pending?: boolean
  /** optimistic message whose send failed. */
  failed?: boolean
}

export interface DashboardChatPage {
  messages: DashboardChatMessage[]
  /** Pass as `beforeTs` to load the next (older) page; null when exhausted. */
  nextBeforeTs: string | null
  hasMore: boolean
}

export interface DashboardChatQueryPayload {
  projectId: string
  /** Which workspace to read; undefined = the card's client workspace. */
  source?: DashboardSource
  /** undefined = every watched channel in that workspace. */
  channelId?: string
  /** Return messages strictly older than this Slack ts. */
  beforeTs?: string
  /** Page size (default 50, max 200). */
  limit?: number
}

export interface DashboardSendMessagePayload {
  projectId: string
  /** Which workspace to post into; undefined = the card's client workspace. */
  source?: DashboardSource
  channelId: string
  text: string
}

export type DashboardSendErrorCode =
  | 'missing_scope'
  | 'not_connected'
  | 'channel_not_found'
  | 'invalid_text'
  | 'slack_error'
  | 'unknown'

export interface DashboardSendMessageResult {
  ok: boolean
  message?: DashboardChatMessage
  error?: string
  code?: DashboardSendErrorCode
  /** Scope Slack requires when code = 'missing_scope'. */
  missingScope?: string
}

/** Slack token health for the Settings section — scopes + send capability. */
export interface DashboardChatTokenStatus {
  connected: boolean
  source: 'oauth' | 'manual' | 'none'
  teamName: string | null
  /** Masked token ("••••abcd") so the user can identify it; never the raw token. */
  maskedToken: string | null
  /** Granted scopes, or null when Slack's auth.test didn't report them. */
  scopes: string[] | null
  /** True when chat:write is present; false when known-missing; null when unknown. */
  canSend: boolean | null
  missingWriteScope: boolean
}

/* ===== v2.7 — AI provider settings (global + per project) ===== */

export type AiProviderId = 'nvidia-nim'

/** Never contains the raw key — only a mask such as "••••abcd". */
export interface AiSettingsPublic {
  provider: AiProviderId
  /** Configured model, null when this scope does not override one. */
  model: string | null
  /** Masked stored key ("••••abcd"); null when none is stored here. */
  apiKeyMask: string | null
  hasKey: boolean
}

export interface ProjectAiSettingsPublic extends AiSettingsPublic {
  /** true = ignore this project's overrides and use the dashboard settings. */
  useGlobal: boolean
}

export type AiSettingsSource = 'project' | 'global' | 'env' | 'none'

/** What the insight engine / project chat will actually use. */
export interface EffectiveAiSettings {
  provider: AiProviderId
  model: string
  modelSource: 'project' | 'global' | 'env'
  keySource: AiSettingsSource
  /** Masked key for the effective key, never the key itself. */
  apiKeyMask: string | null
}

export interface DashboardAiSettingsView {
  global: AiSettingsPublic
  /** null when the view was requested without a project. */
  project: ProjectAiSettingsPublic | null
  effective: EffectiveAiSettings
}

export interface DashboardAiSettingsQueryPayload {
  projectId?: string
}

export interface DashboardAiSettingsSavePayload {
  /** Omitted = dashboard-level global settings. */
  projectId?: string
  useGlobal?: boolean
  provider?: AiProviderId
  /** null clears the override; undefined keeps the stored value. */
  model?: string | null
  /** null clears the key; undefined keeps it; a string replaces it. */
  apiKey?: string | null
}

export interface DashboardAiModelsQueryPayload {
  projectId?: string
}

export interface DashboardAiModelsResult {
  models: string[]
  source: AiSettingsSource
  error?: string
}
