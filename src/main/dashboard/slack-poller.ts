/** Slack API polling dedicated to the dashboard (existing client untouched). */
import type { DashboardStoredMessage } from './delta-store'

export interface PollFetchResult {
  messages: DashboardStoredMessage[]
  hasMore: boolean
}

interface HistoryResponse {
  ok: boolean
  error?: string
  messages?: Array<{
    ts: string
    user?: string
    text?: string
    subtype?: string
  }>
  response_metadata?: { next_cursor?: string }
}

interface AuthTestResponse {
  ok: boolean
  error?: string
  team_id?: string
  team?: string
  user_id?: string
  user?: string
  url?: string
  scopes?: string[]
}

interface UsersListResponse {
  ok: boolean
  error?: string
  members?: Array<{
    id: string
    name?: string
    real_name?: string
    profile?: { display_name?: string; real_name?: string }
  }>
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callApi<T extends { ok: boolean; error?: string }>(
  method: string,
  token: string,
  params: Record<string, string>
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params)
  })
  const body = (await res.json()) as T
  if (!body.ok) {
    if (body.error === 'ratelimited') {
      await sleep(Number(res.headers.get('Retry-After') ?? '1') * 1000)
      return callApi(method, token, params)
    }
    const err = new Error(`slack ${method}: ${body.error}`)
    ;(err as Error & { slackError?: string }).slackError = body.error
    throw err
  }
  return body
}

export interface SlackPollerOptions {
  baseUrl?: string
  draftPage?: <T>(url: string, token: string, params: Record<string, string>) => Promise<T>
}

export class SlackPoller {
  private readonly baseUrl: string

  constructor(options: SlackPollerOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://slack.com/api/'
  }

  /** Fetch newest `limit` messages older than nothing, newer than afterTs. */
  async fetchHistory(input: {
    token: string
    channelId: string
    afterTs?: string
    limit?: number
  }): Promise<PollFetchResult> {
    if (this.baseUrl.startsWith('http://_FAKE')) return { messages: [], hasMore: false }
    const res = await callApi<HistoryResponse>('conversations.history', input.token, {
      channel: input.channelId,
      limit: String(input.limit ?? 200),
      ...(input.afterTs ? { oldest: input.afterTs } : {})
    })
    const messages: DashboardStoredMessage[] = (res.messages ?? []).map((m) => ({
      ts: m.ts,
      user: m.user,
      text: m.text ?? '',
      subtype: m.subtype
    }))
    return {
      messages,
      hasMore: Boolean(res.response_metadata?.next_cursor)
    }
  }

  async authTest(token: string): Promise<{
    valid: boolean
    teamId?: string
    teamName?: string
    userName?: string
    scopes?: string[]
    error?: string
  }> {
    if (this.baseUrl.startsWith('http://_FAKE')) {
      return { valid: true, teamId: 'FAKE_TEAM', teamName: 'Fake Team' }
    }
    const res = await callApi<AuthTestResponse>('auth.test', token, {})
    return {
      valid: true,
      teamId: res.team_id,
      teamName: res.team,
      userName: res.user,
      scopes: res.scopes,
      error: undefined
    }
  }

  /** real/display name map for a workspace — used to label prompts. */
  async usersList(token: string): Promise<Map<string, string>> {
    if (this.baseUrl.startsWith('http://_FAKE')) return new Map()
    const map = new Map<string, string>()
    try {
      const res = await callApi<UsersListResponse>('users.list', token, { limit: '200' })
      for (const m of res.members ?? []) {
        const name =
          m.profile?.display_name || m.profile?.real_name || m.real_name || m.name || m.id
        if (m.id) map.set(m.id, name)
      }
    } catch {
      // name mapping is best-effort; raw IDs still work downstream
    }
    return map
  }
}
