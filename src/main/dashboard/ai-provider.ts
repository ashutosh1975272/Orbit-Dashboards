/** NVIDIA NIM provider (v2.2) — OpenAI-compatible chat for dashboard insights.
 * Universal: one key + model pair in .env, used everywhere; falls back
 * automatically from primary to fallback model. No raw secrets ever logged.
 *
 * Reasoning models (nemotron-3.x) spend the whole token budget on
 * "reasoning_content" and then return an empty answer, so the request can
 * disable thinking explicitly (`chat_template_kwargs.enable_thinking`).
 */

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'

export interface NimChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface NimChatOptions {
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

export interface NimProviderConfig {
  apiKey: string
  modelPrimary: string
  modelFallback?: string
  baseUrl?: string
  timeoutMs?: number
  /** Disable the model's reasoning trace (fast + always answers). */
  enableThinking?: boolean
  /** Default completion budget per call. */
  maxTokens?: number
}

export interface NimChatResult {
  content: string
  modelUsed: string
  tokens: number
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export class NimProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly defaultTimeoutMs: number
  private readonly defaultMaxTokens: number
  private readonly enableThinking: boolean
  readonly modelPrimary: string
  readonly modelFallback: string | undefined

  constructor(config: NimProviderConfig) {
    if (!config.apiKey) throw new Error('NIM api key missing')
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    this.modelPrimary = config.modelPrimary
    this.modelFallback = config.modelFallback || undefined
    this.defaultTimeoutMs = config.timeoutMs ?? 90_000
    this.defaultMaxTokens = config.maxTokens ?? 2000
    this.enableThinking = config.enableThinking ?? false
  }

  private async chatOnce(
    model: string,
    messages: NimChatMessage[],
    opts: NimChatOptions
  ): Promise<NimChatResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? this.defaultTimeoutMs)
    try {
      const payload: Record<string, unknown> = {
        model,
        messages,
        max_tokens: opts.maxTokens ?? this.defaultMaxTokens,
        temperature: opts.temperature ?? 0.2
      }
      if (!this.enableThinking) {
        payload.chat_template_kwargs = { enable_thinking: false }
      }
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        throw new Error(`nim http ${res.status}`)
      }
      const body = (await res.json()) as {
        model?: string
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
        usage?: { total_tokens?: number }
      }
      const content = body.choices?.[0]?.message?.content ?? ''
      if (!content.trim()) throw new Error('nim empty content')
      return {
        content,
        modelUsed: body.model ?? model,
        tokens: body.usage?.total_tokens ?? 0
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Try primary, then fallback — network/timeout/HTTP errors only. */
  async chat(messages: NimChatMessage[], opts: NimChatOptions = {}): Promise<NimChatResult> {
    let primaryError: unknown
    try {
      return await this.chatOnce(this.modelPrimary, messages, opts)
    } catch (err) {
      primaryError = err
      if (!this.modelFallback) throw err
    }
    try {
      return await this.chatOnce(this.modelFallback, messages, opts)
    } catch (err) {
      throw new Error(
        `nim primary failed (${errorMessage(primaryError)}); fallback failed (${errorMessage(err)})`
      )
    }
  }

  /** Live model catalog (also used by tests via injected base). */
  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    })
    if (!res.ok) throw new Error(`nim models http ${res.status}`)
    const body = (await res.json()) as { data?: Array<{ id?: string }> }
    return (body.data ?? []).map((m) => m.id ?? '').filter(Boolean)
  }

  /**
   * Chat that must answer with JSON. The reply is validated and, when the
   * model wraps it in prose, retried once with a stricter instruction.
   */
  async chatJson(
    messages: NimChatMessage[],
    opts: NimChatOptions = {}
  ): Promise<{ data: Record<string, unknown>; content: string; modelUsed: string }> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ask: NimChatMessage[] =
        attempt === 0
          ? messages
          : [
              ...messages,
              {
                role: 'user',
                content: 'Reply with ONLY the JSON object — no prose, no markdown fences.'
              }
            ]
      const res = await this.chat(ask, opts)
      const data = extractJsonObject(res.content)
      if (data) {
        return { data, content: res.content, modelUsed: res.modelUsed }
      }
      lastError = new Error('nim reply was not valid JSON')
    }
    throw lastError ?? new Error('nim reply was not valid JSON')
  }
}

/** Extract the first JSON object from a model reply (tolerates prose/code fences). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = [fenced?.[1], text]
  for (const candidate of candidates) {
    if (!candidate) continue
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) continue
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // try next candidate
    }
  }
  return null
}
