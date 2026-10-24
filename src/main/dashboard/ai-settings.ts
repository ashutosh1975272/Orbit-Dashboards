/**
 * resolveSettings(projectId) — the single place that decides which API key and
 * model the AI features use.
 *
 * Order (per field): project override (unless "use global") → dashboard
 * settings → NVIDIA NIM environment defaults. The raw key never leaves the
 * main process; public views carry a mask only.
 */

import { NimProvider } from './ai-provider'
import { AiSettingsStore, maskKey } from './ai-settings-store'
import type {
  AiProviderId,
  AiSettingsSource,
  DashboardAiModelsResult,
  DashboardAiSettingsSavePayload,
  DashboardAiSettingsView
} from '../../shared/dashboard-contract'

export interface AiEnvDefaults {
  apiKey: string
  model: string
  fallbackModel?: string
}

export interface ResolvedAiSettings {
  provider: AiProviderId
  model: string
  modelFallback?: string
  /** Plain key — main process only. Never include this in a public view. */
  apiKey: string | null
  modelSource: 'project' | 'global' | 'env'
  keySource: AiSettingsSource
}

interface AiSettingsServiceOptions {
  store: AiSettingsStore
  env: AiEnvDefaults
  timeoutMs?: number
  maxTokens?: number
  enableThinking?: boolean
}

const MAX_CACHED_PROVIDERS = 8

export class AiSettingsService {
  private readonly store: AiSettingsStore
  private readonly env: AiEnvDefaults
  private readonly timeoutMs: number | undefined
  private readonly maxTokens: number | undefined
  private readonly enableThinking: boolean
  private readonly providers = new Map<string, NimProvider>()

  constructor(options: AiSettingsServiceOptions) {
    this.store = options.store
    this.env = options.env
    this.timeoutMs = options.timeoutMs
    this.maxTokens = options.maxTokens
    this.enableThinking = options.enableThinking ?? false
  }

  /** Resolve the effective key/model for one project (or the dashboard). */
  async resolveSettings(projectId?: string): Promise<ResolvedAiSettings> {
    const global = await this.store.readGlobal()
    const project = projectId ? await this.store.readProject(projectId) : null
    const useGlobal = !project || project.useGlobal !== false

    const projectKey = useGlobal ? null : await this.store.readKey(project)
    const globalKey = await this.store.readKey(global)
    const envKey = this.env.apiKey.trim() || null

    const apiKey = projectKey ?? globalKey ?? envKey
    const keySource: AiSettingsSource = projectKey
      ? 'project'
      : globalKey
        ? 'global'
        : envKey
          ? 'env'
          : 'none'

    const projectModel = useGlobal ? null : (project?.model?.trim() ?? null)
    const globalModel = global.model?.trim() || null
    const envModel = this.env.model.trim()
    const model = projectModel ?? globalModel ?? envModel
    const modelSource = projectModel ? 'project' : globalModel ? 'global' : 'env'

    return {
      provider: (!useGlobal && project?.provider) || global.provider || 'nvidia-nim',
      model,
      modelFallback: this.env.fallbackModel,
      apiKey,
      modelSource,
      keySource
    }
  }

  /** A ready provider, or null when no key is configured anywhere. */
  async getProvider(projectId?: string): Promise<NimProvider | null> {
    const resolved = await this.resolveSettings(projectId)
    if (!resolved.apiKey) return null
    const cacheKey = `${resolved.apiKey}\u0000${resolved.model}\u0000${resolved.modelFallback ?? ''}`
    const cached = this.providers.get(cacheKey)
    if (cached) return cached

    const provider = new NimProvider({
      apiKey: resolved.apiKey,
      modelPrimary: resolved.model,
      modelFallback: resolved.modelFallback,
      timeoutMs: this.timeoutMs,
      maxTokens: this.maxTokens,
      enableThinking: this.enableThinking
    })
    if (this.providers.size >= MAX_CACHED_PROVIDERS) {
      const oldest = this.providers.keys().next().value
      if (oldest) this.providers.delete(oldest)
    }
    this.providers.set(cacheKey, provider)
    return provider
  }

  /** Renderer-safe view: masks instead of keys. */
  async publicView(projectId?: string): Promise<DashboardAiSettingsView> {
    const global = await this.store.readGlobal()
    const globalKey = await this.store.readKey(global)
    const project = projectId ? await this.store.readProject(projectId) : null
    const projectKey = project ? await this.store.readKey(project) : null
    const effective = await this.resolveSettings(projectId)

    return {
      global: {
        provider: global.provider ?? 'nvidia-nim',
        model: global.model ?? null,
        apiKeyMask: maskKey(globalKey),
        hasKey: Boolean(globalKey)
      },
      project: projectId
        ? {
            provider: project?.provider ?? 'nvidia-nim',
            model: project?.model ?? null,
            apiKeyMask: maskKey(projectKey),
            hasKey: Boolean(projectKey),
            useGlobal: project?.useGlobal !== false
          }
        : null,
      effective: {
        provider: effective.provider,
        model: effective.model,
        modelSource: effective.modelSource,
        keySource: effective.keySource,
        apiKeyMask: maskKey(effective.apiKey)
      }
    }
  }

  async save(payload: DashboardAiSettingsSavePayload): Promise<DashboardAiSettingsView> {
    if (payload.provider && payload.provider !== 'nvidia-nim') {
      throw new Error('Unsupported AI provider')
    }
    if (payload.apiKey && payload.apiKey.length > 512) {
      throw new Error('API key is too long')
    }
    if (payload.model && payload.model.length > 200) {
      throw new Error('Model id is too long')
    }

    const patch = {
      provider: payload.provider,
      model: payload.model,
      apiKey: payload.apiKey,
      useGlobal: payload.useGlobal
    }
    if (payload.projectId) {
      await this.store.saveProject(payload.projectId, patch)
      return this.publicView(payload.projectId)
    }
    await this.store.saveGlobal(patch)
    return this.publicView()
  }

  async listModels(projectId?: string): Promise<DashboardAiModelsResult> {
    const resolved = await this.resolveSettings(projectId)
    if (!resolved.apiKey) {
      return {
        models: [],
        source: resolved.keySource,
        error: 'No API key configured yet.'
      }
    }
    try {
      const provider = await this.getProvider(projectId)
      const models = (await provider!.listModels()).filter(Boolean)
      return {
        models: [...new Set(models)].sort(),
        source: resolved.keySource
      }
    } catch (err) {
      return {
        models: [],
        source: resolved.keySource,
        error: err instanceof Error ? err.message : 'Could not load the model list'
      }
    }
  }

  async clearProject(projectId: string): Promise<void> {
    await this.store.clearProject(projectId)
  }
}
