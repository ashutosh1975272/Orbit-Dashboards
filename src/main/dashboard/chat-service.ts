import type {
  DashboardChatMessage,
  DashboardChatPage,
  DashboardChatQueryPayload,
  DashboardProject,
  DashboardSendMessagePayload,
  DashboardSendMessageResult
} from '../../shared/dashboard-contract'
import type { DashboardDeltaStore, DashboardStoredMessage } from './delta-store'
import { compareTs } from './delta-store'
import type { MonitorStore } from './monitor-store'
import { SlackPoller } from './slack-poller'

/** Minimal poller surface the chat service needs (fakeable in tests). */
export interface ChatPoller {
  authTest(token: string): Promise<{
    valid: boolean
    userId?: string
    scopes?: string[]
    error?: string
  }>
  usersList(token: string): Promise<Map<string, string>>
  postMessage(input: {
    token: string
    channelId: string
    text: string
  }): Promise<{ ts: string; channelId: string }>
}

export interface ChatServiceDeps {
  monitorStore: MonitorStore
  deltaStore: DashboardDeltaStore
  oauthTokenProvider: { tryGet(profileId: string, teamId: string): Promise<string | null> }
  /** Stored scopes from the OAuth workspace link (best effort). */
  oauthScopesProvider?: (profileId: string, teamId: string) => Promise<string[] | null>
  pollerFactory?: () => ChatPoller
  log?: (msg: string) => void
  now?: () => number
}

export interface ChatRow {
  msg: DashboardStoredMessage
  channelId: string
  channelName: string
}

interface ChatWorkspaceContext {
  at: number
  names: Map<string, string>
  selfUserId: string | null
  scopes: string[] | null
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MAX_TEXT_LENGTH = 4000
const CONTEXT_TTL_MS = 5 * 60_000

export const MISSING_SCOPE_MESSAGE =
  "This Slack token is missing the chat:write scope, so Orbit cannot post replies. Add chat:write to the Slack app's User Token Scopes (OAuth & Permissions), reinstall or reconnect the workspace, then try again."

export const NOT_CONNECTED_MESSAGE =
  'No Slack token is available for this workspace. Reconnect the workspace or add a manual token.'

/** Rows must be sorted ascending by ts. Returns the newest `limit` older-than-`beforeTs` slice. */
export function selectChatPage(
  rows: ChatRow[],
  beforeTs: string | undefined,
  limit: number
): { page: ChatRow[]; hasMore: boolean; nextBeforeTs: string | null } {
  const filtered = beforeTs ? rows.filter((row) => compareTs(row.msg.ts, beforeTs) < 0) : rows
  const page = filtered.slice(-limit)
  const hasMore = filtered.length > page.length
  return {
    page,
    hasMore,
    nextBeforeTs: hasMore && page.length > 0 ? page[0].msg.ts : null
  }
}

function isoFromTs(ts: string): string {
  const seconds = Number(ts)
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString()
}

function isDisplayable(msg: DashboardStoredMessage): boolean {
  if (!msg.text || !msg.text.trim()) return false
  return !(
    msg.subtype === 'message_changed' ||
    msg.subtype === 'message_deleted' ||
    msg.subtype === 'channel_join' ||
    msg.subtype === 'channel_leave'
  )
}

/**
 * Local Slack chat for one project: reads the delta store (JSON per channel) and
 * posts replies with chat.postMessage. The only writable surface in the dashboard.
 */
export class DashboardChatService {
  private readonly monitorStore: MonitorStore
  private readonly deltaStore: DashboardDeltaStore
  private readonly oauthTokenProvider: ChatServiceDeps['oauthTokenProvider']
  private readonly oauthScopesProvider?: ChatServiceDeps['oauthScopesProvider']
  private readonly pollerFactory: () => ChatPoller
  private readonly log: (msg: string) => void
  private readonly now: () => number
  private readonly contextCache = new Map<string, ChatWorkspaceContext>()

  constructor(deps: ChatServiceDeps) {
    this.monitorStore = deps.monitorStore
    this.deltaStore = deps.deltaStore
    this.oauthTokenProvider = deps.oauthTokenProvider
    this.oauthScopesProvider = deps.oauthScopesProvider
    this.pollerFactory = deps.pollerFactory ?? ((): ChatPoller => new SlackPoller())
    this.log = deps.log ?? ((): void => undefined)
    this.now = deps.now ?? ((): number => Date.now())
  }

  private async projectFor(projectId: string): Promise<DashboardProject | null> {
    const projects = await this.monitorStore.listProjects()
    return projects.find((p) => p.id === projectId) ?? null
  }

  private async tokenFor(project: DashboardProject): Promise<string | null> {
    if (project.tokenSource === 'manual') {
      if (!project.manualTokenKey) return null
      return this.monitorStore.getManualToken(project.manualTokenKey)
    }
    return this.oauthTokenProvider.tryGet(project.profileId, project.teamId)
  }

  /** Best-effort names + token owner + scopes, cached per workspace for 5 minutes. */
  private async workspaceContext(
    project: DashboardProject,
    token: string
  ): Promise<ChatWorkspaceContext> {
    const key = `${project.profileId}:${project.teamId}`
    const cached = this.contextCache.get(key)
    const now = this.now()
    if (cached && now - cached.at < CONTEXT_TTL_MS) return cached

    const poller = this.pollerFactory()
    let names = new Map<string, string>()
    let selfUserId: string | null = null
    let scopes: string[] | null = null

    try {
      const auth = await poller.authTest(token)
      selfUserId = auth.userId ?? null
      scopes = Array.isArray(auth.scopes) ? auth.scopes : null
    } catch (err) {
      this.log(`[dashboard] chat auth.test failed for ${project.name}: ${String(err)}`)
    }
    try {
      names = await poller.usersList(token)
    } catch (err) {
      this.log(`[dashboard] chat users.list failed for ${project.name}: ${String(err)}`)
    }

    const context: ChatWorkspaceContext = { at: now, names, selfUserId, scopes }
    this.contextCache.set(key, context)
    return context
  }

  /**
   * OAuth links store the scopes granted at connect time. Slack's auth.test does
   * not report scopes for manual tokens, so those are only validated by Slack on
   * chat.postMessage and mapped to `missing_scope` below.
   */
  private async scopesFor(project: DashboardProject, token: string): Promise<string[] | null> {
    if (project.tokenSource === 'oauth' && this.oauthScopesProvider) {
      try {
        const stored = await this.oauthScopesProvider(project.profileId, project.teamId)
        if (stored && stored.length > 0) return stored
      } catch {
        // fall through to auth.test
      }
    }
    try {
      const context = await this.workspaceContext(project, token)
      return context.scopes
    } catch {
      return null
    }
  }

  private toChatMessage(
    project: DashboardProject,
    row: { channelId: string; channelName: string },
    msg: DashboardStoredMessage,
    context: ChatWorkspaceContext | null
  ): DashboardChatMessage {
    const userId = msg.user ?? ''
    const selfUserId = project.selfUserId ?? context?.selfUserId ?? null
    const resolved = userId ? context?.names.get(userId) : undefined
    return {
      ts: msg.ts,
      channelId: row.channelId,
      channelName: row.channelName,
      userId,
      userName: resolved || (selfUserId && userId === selfUserId ? 'You' : userId || 'Unknown'),
      text: msg.text ?? '',
      atIso: isoFromTs(msg.ts),
      isMine: Boolean(selfUserId && userId === selfUserId)
    }
  }

  async loadMessages(payload: DashboardChatQueryPayload): Promise<DashboardChatPage> {
    const project = await this.projectFor(payload.projectId)
    if (!project) return { messages: [], nextBeforeTs: null, hasMore: false }

    const monitors = payload.channelId
      ? project.monitors.filter((m) => m.channelId === payload.channelId)
      : project.monitors

    const rows: ChatRow[] = []
    for (const monitor of monitors) {
      const delta = await this.deltaStore.load(project.profileId, project.teamId, monitor.channelId)
      for (const msg of delta?.messages ?? []) {
        if (!isDisplayable(msg)) continue
        rows.push({
          msg,
          channelId: monitor.channelId,
          channelName: monitor.channelName
        })
      }
    }
    rows.sort((a, b) => compareTs(a.msg.ts, b.msg.ts))

    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(payload.limit ?? DEFAULT_LIMIT)))
    const { page, hasMore, nextBeforeTs } = selectChatPage(rows, payload.beforeTs, limit)

    let context: ChatWorkspaceContext | null = null
    try {
      const token = await this.tokenFor(project)
      if (token) context = await this.workspaceContext(project, token)
    } catch {
      // names fall back to Slack ids
    }

    return {
      messages: page.map((row) => this.toChatMessage(project, row, row.msg, context)),
      nextBeforeTs,
      hasMore
    }
  }

  async sendMessage(payload: DashboardSendMessagePayload): Promise<DashboardSendMessageResult> {
    const text = (payload.text ?? '').trim()
    if (!text) {
      return { ok: false, code: 'invalid_text', error: 'Write a message before sending.' }
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return {
        ok: false,
        code: 'invalid_text',
        error: `Slack messages are limited to ${MAX_TEXT_LENGTH} characters.`
      }
    }

    const project = await this.projectFor(payload.projectId)
    if (!project) {
      return { ok: false, code: 'not_connected', error: 'This project no longer exists.' }
    }
    const monitor = project.monitors.find((m) => m.channelId === payload.channelId)
    if (!monitor) {
      return {
        ok: false,
        code: 'channel_not_found',
        error: 'That channel is not watched by this project.'
      }
    }

    const token = await this.tokenFor(project)
    if (!token) {
      return { ok: false, code: 'not_connected', error: NOT_CONNECTED_MESSAGE }
    }

    const scopes = await this.scopesFor(project, token)
    if (scopes && scopes.length > 0 && !scopes.includes('chat:write')) {
      return {
        ok: false,
        code: 'missing_scope',
        missingScope: 'chat:write',
        error: MISSING_SCOPE_MESSAGE
      }
    }

    try {
      const sent = await this.pollerFactory().postMessage({
        token,
        channelId: monitor.channelId,
        text
      })

      let context: ChatWorkspaceContext | null = null
      try {
        context = await this.workspaceContext(project, token)
      } catch {
        // message still succeeded; names fall back to ids
      }
      const selfUserId = project.selfUserId ?? context?.selfUserId ?? undefined

      // Persist locally so the reply survives reloads and the next sync dedupes it.
      await this.deltaStore.appendMessages({
        profileId: project.profileId,
        teamId: project.teamId,
        channelId: monitor.channelId,
        channelName: monitor.channelName,
        messages: [{ ts: sent.ts, user: selfUserId, text }]
      })

      return {
        ok: true,
        message: this.toChatMessage(
          project,
          { channelId: monitor.channelId, channelName: monitor.channelName },
          { ts: sent.ts, user: selfUserId, text },
          context
        )
      }
    } catch (err) {
      const slackError = (err as Error & { slackError?: string }).slackError
      if (slackError === 'missing_scope') {
        return {
          ok: false,
          code: 'missing_scope',
          missingScope: 'chat:write',
          error: MISSING_SCOPE_MESSAGE
        }
      }
      if (slackError === 'channel_not_found' || slackError === 'not_in_channel') {
        return {
          ok: false,
          code: 'channel_not_found',
          error: `Slack could not post to #${monitor.channelName}. Check that the channel still exists and the token can post there.`
        }
      }
      if (
        slackError === 'invalid_auth' ||
        slackError === 'not_authed' ||
        slackError === 'token_revoked'
      ) {
        return { ok: false, code: 'not_connected', error: NOT_CONNECTED_MESSAGE }
      }
      return {
        ok: false,
        code: slackError ? 'slack_error' : 'unknown',
        error: slackError
          ? `Slack rejected the message: ${slackError}`
          : 'Could not send the message to Slack.'
      }
    }
  }
}
