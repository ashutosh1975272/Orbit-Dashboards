/**
 * One resolver for every dashboard feature. Global config = Our Slack + NVIDIA;
 * a project adds its required client workspace and may override either source.
 * Raw secrets stay in main; public views carry masks only.
 */

import type {
  DashboardGlobalConfig,
  DashboardMonitor,
  DashboardProject
} from '../../shared/dashboard-contract'
import type { AiSettingsService, ResolvedAiSettings } from './ai-settings'
import type { MonitorStore } from './monitor-store'
import type { WorkspaceMappingStore } from './workspace-mapping-store'
import { maskToken, type TeamWorkspaceStore } from './team-workspace-store'

export interface ResolvedProjectSettings {
  client: {
    token: string | null
    workspaceName: string | null
    teamId: string
    channels: DashboardMonitor[]
    source: 'project' | 'none'
    /** Workspace this project is mapped to (null if unmapped). */
    mappedWorkspaceId: string | null
    mappedWorkspaceName: string | null
  }
  ourSlack: {
    token: string | null
    workspaceName: string | null
    teamId: string | null
    channels: DashboardMonitor[]
    source: 'global' | 'project' | 'none'
  }
  ai: ResolvedAiSettings
}

export interface ConfigServiceOptions {
  aiSettings: AiSettingsService
  teamWorkspace: TeamWorkspaceStore
  monitorStore: MonitorStore
  workspaceMapping: WorkspaceMappingStore
  oauthTokenProvider: {
    tryGet(profileId: string, teamId: string): Promise<string | null>
  }
}

export class ConfigService {
  private readonly aiSettings: AiSettingsService
  private readonly teamWorkspace: TeamWorkspaceStore
  private readonly monitorStore: MonitorStore
  private readonly workspaceMapping: WorkspaceMappingStore
  private readonly oauthTokenProvider: ConfigServiceOptions['oauthTokenProvider']

  constructor(options: ConfigServiceOptions) {
    this.aiSettings = options.aiSettings
    this.teamWorkspace = options.teamWorkspace
    this.monitorStore = options.monitorStore
    this.workspaceMapping = options.workspaceMapping
    this.oauthTokenProvider = options.oauthTokenProvider
  }

  /** Masked app-level config plus how many projects inherit it. */
  async publicGlobalConfig(): Promise<DashboardGlobalConfig> {
    const [ourSlack, ai, projects, aiUsage] = await Promise.all([
      this.teamWorkspace.readPublic(),
      this.aiSettings.publicView(),
      this.monitorStore.listProjects(),
      this.aiSettings.usageCounts()
    ])

    return {
      ourSlack,
      nvidia: {
        configured: ai.global.hasKey,
        apiKeyMask: ai.global.apiKeyMask,
        chatModel: ai.global.model,
        embeddingModel: ai.global.embeddingModel,
        status: ai.global.hasKey ? ai.global.status : 'not-configured',
        lastVerifiedAt: ai.global.lastVerifiedAt
      },
      usage: {
        projects: projects.length,
        usingGlobalAi: aiUsage.usingGlobalAi,
        usingGlobalOurSlack: projects.filter((project) => !project.ourSlackTokenKey).length
      }
    }
  }

  /** Effective values for sync/chat/insight/future agent + embeddings. */
  async resolveSettings(projectId?: string): Promise<ResolvedProjectSettings> {
    const ai = await this.aiSettings.resolveSettings(projectId)
    const globalOurSlack = await this.teamWorkspace.getConnection()
    const project = projectId
      ? (await this.monitorStore.listProjects()).find((p) => p.id === projectId)
      : undefined

    const clientToken = project ? await this.clientToken(project) : null
    const overrideToken = project?.ourSlackTokenKey
      ? await this.monitorStore.getManualToken(project.ourSlackTokenKey)
      : null
    const ourSlackToken = overrideToken ?? globalOurSlack?.token ?? null
    const ourSlackSource: 'global' | 'project' | 'none' = overrideToken
      ? 'project'
      : globalOurSlack
        ? 'global'
        : 'none'

    // Until per-project mapping is fully rolled out (Phase 4), a project with
    // no mapping keeps reading the legacy global pins so cards do not go dark.
    const ourSlackChannels =
      project?.ourSlackChannels ??
      (project?.ourSlackTokenKey ? [] : (globalOurSlack?.channels ?? []))

    // Resolve mapping: which workspace is this project mapped to?
    let mappedWorkspaceId: string | null = null
    let mappedWorkspaceName: string | null = null
    if (project) {
      const mappedWorkspace = await this.workspaceMapping.getWorkspaceForProject(project.id)
      if (mappedWorkspace) {
        mappedWorkspaceId = mappedWorkspace
        mappedWorkspaceName = project.teamId === mappedWorkspace ? (project.teamName ?? null) : mappedWorkspace
      }
    }

    return {
      client: {
        token: clientToken,
        workspaceName: project?.teamName ?? null,
        teamId: project?.teamId ?? '',
        channels: project?.monitors ?? [],
        source: project ? 'project' : 'none',
        mappedWorkspaceId,
        mappedWorkspaceName
      },
      ourSlack: {
        token: ourSlackToken,
        workspaceName: project?.ourSlackTokenKey
          ? (project.ourSlackTeamName ?? null)
          : (globalOurSlack?.teamName ?? null),
        teamId: project?.ourSlackTokenKey
          ? (project.ourSlackTeamId ?? null)
          : (globalOurSlack?.teamId ?? null),
        channels: ourSlackChannels,
        source: ourSlackSource
      },
      ai
    }
  }

  /** Public mask for the effective client token (never the raw value). */
  async maskedClientToken(projectId: string): Promise<string | null> {
    const resolved = await this.resolveSettings(projectId)
    return maskToken(resolved.client.token)
  }

  private async clientToken(project: DashboardProject): Promise<string | null> {
    if (project.manualTokenKey) {
      const token = await this.monitorStore.getManualToken(project.manualTokenKey)
      if (token) return token
    }
    if (project.profileId && project.teamId) {
      return this.oauthTokenProvider.tryGet(project.profileId, project.teamId)
    }
    return null
  }
}
