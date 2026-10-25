import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-contract'
import type {
  DashboardAiModelsQueryPayload,
  DashboardAiModelsResult,
  DashboardAiSettingsQueryPayload,
  DashboardAiSettingsSavePayload,
  DashboardAiSettingsView,
  DashboardManualToken,
  DashboardChatPage,
  DashboardChatQueryPayload,
  DashboardChatTokenStatus,
  DashboardListChannelsPayload,
  DashboardMarkViewedPayload,
  DashboardRunSchedulePayload,
  DashboardSendMessagePayload,
  DashboardSendMessageResult,
  DashboardSnapshot,
  DashboardSyncProgressPayload,
  DashboardUpdateSchedulePayload,
  DashboardTeamWorkspaceCandidate,
  DashboardTeamWorkspaceChannelsPayload,
  DashboardTeamWorkspaceConnectPayload,
  ManualTokenPayload,
  ProjectDeletePayload,
  ProjectUpsertPayload,
  RecentActivity,
  ValidateTokenResultPayload,
  ProjectSidebarState,
  SidebarState
} from '../../shared/dashboard-contract'
import type { AiSettingsService } from '../dashboard/ai-settings'
import type { DashboardSyncEngine } from '../dashboard/sync-engine'
import type { DashboardScheduler } from '../dashboard/scheduler'
import type { MonitorStore } from '../dashboard/monitor-store'
import type { DashboardChatService } from '../dashboard/chat-service'
import { SlackPoller } from '../dashboard/slack-poller'
import { listChannels } from '../slack/slack-api-client'
import type { SlackChannelSummary } from '../../shared/types'
import { handleInvoke } from './handle'
import type { HistoryStore } from '../dashboard/history-store'
import type { DashboardSidebarStateStore } from '../dashboard/sidebar-state'
import { maskToken, type TeamWorkspaceStore } from '../dashboard/team-workspace-store'
import type { DashboardViewedStore } from '../dashboard/viewed-store'

export interface DashboardIpcDeps {
  monitorStore: MonitorStore
  engine: DashboardSyncEngine
  scheduler: DashboardScheduler
  getMainWindow: () => BrowserWindow | null
  oauthTokenProvider: { tryGet(profileId: string, teamId: string): Promise<string | null> }
  /** v2.2 — insight history (optional, additive) */
  historyStore?: HistoryStore
  /** v2.3 — the "Recent" strip feed (built from local data, no LLM call) */
  buildRecent?: () => Promise<RecentActivity[]>
  /** v2.3 — the top digest across workspaces */
  getDigest?: () => Promise<DashboardSnapshot['digest']>
  /** v2.4 — sidebar state per project */
  sidebarStateStore?: DashboardSidebarStateStore
  /** v2.6 — Slack Chat tab (local history + replies) */
  chatService?: DashboardChatService
  /** v2.7 — global + per-project AI provider settings */
  aiSettings?: AiSettingsService
  /** v3 — the one team workspace shared by every card */
  teamWorkspace?: TeamWorkspaceStore
  /** v3 — workspaces the app can already reach, offered when connecting ours */
  listTeamWorkspaceCandidates?: () => Promise<DashboardTeamWorkspaceCandidate[]>
  /** Phase A — when a card's Dashboard was last looked at */
  viewedStore?: DashboardViewedStore
}

export interface DashboardIpcRegistration {
  /** dispose of progress subscription (useful in tests) */
  dispose: () => void
}

export function registerDashboardIpc(deps: DashboardIpcDeps): DashboardIpcRegistration {
  const broadcast = (channel: string, payload: unknown, excludeDestroyed = true): void => {
    void excludeDestroyed
    const win = deps.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }

  const broadcastSnapshot = async (): Promise<DashboardSnapshot> => {
    const snapshot = await publicSnapshot()
    broadcast(IpcChannels.DashboardSnapshotChanged, snapshot)
    return snapshot
  }

  const publicSnapshot = async (): Promise<DashboardSnapshot> => {
    const projects = await deps.engine.buildSnapshot()
    const manualTokens = (await deps.monitorStore.listManualTokens()).map(
      (t: { key: string; persisted: boolean }): DashboardManualToken => ({
        key: t.key,
        validated: t.persisted
      })
    )
    return {
      projects,
      manualTokens,
      syncIntervalSeconds:
        (await deps.scheduler.getState()).settings.slackSync.intervalMinutes * 60,
      digest: deps.getDigest ? await deps.getDigest() : null
    }
  }

  handleInvoke(IpcChannels.DashboardGetSnapshot, async () => publicSnapshot())

  handleInvoke(
    IpcChannels.DashboardMarkViewed,
    async (payload: DashboardMarkViewedPayload): Promise<string> => {
      if (!deps.viewedStore) throw new Error('Dashboard viewing state is unavailable.')
      const projectId = String(payload?.projectId ?? '').trim()
      if (!projectId) throw new Error('A project id is required.')
      return deps.viewedStore.markViewed(projectId, payload.atIso)
    }
  )

  handleInvoke(IpcChannels.DashboardSchedulesGet, async () => deps.scheduler.getState())

  handleInvoke(
    IpcChannels.DashboardSchedulesUpdate,
    async (payload: DashboardUpdateSchedulePayload) => deps.scheduler.updateSettings(payload ?? {})
  )

  handleInvoke(IpcChannels.DashboardSchedulesRun, async (payload: DashboardRunSchedulePayload) => {
    if (payload?.kind !== 'slack-sync' && payload?.kind !== 'daily-recheck') {
      throw new Error('Unknown schedule.')
    }
    return deps.scheduler.runNow(payload.kind)
  })

  handleInvoke(
    IpcChannels.DashboardListChannels,
    async (payload: DashboardListChannelsPayload): Promise<SlackChannelSummary[]> => {
      let token: string | null = null
      if (payload.source === 'ours') {
        const connection = await deps.teamWorkspace?.getConnection()
        if (!connection) return []
        token =
          connection.token ??
          (await deps.oauthTokenProvider.tryGet(connection.profileId, connection.teamId))
      } else if (payload.tokenSource === 'manual') {
        token = payload.manualTokenKey
          ? await deps.monitorStore.getManualToken(payload.manualTokenKey)
          : null
      } else if (payload.profileId && payload.teamId) {
        token = await deps.oauthTokenProvider.tryGet(payload.profileId, payload.teamId)
      }
      if (!token) return []
      return listChannels(token)
    }
  )

  handleInvoke(
    IpcChannels.DashboardViewSet,
    async (payload: { open: boolean; appId?: string | null }) => {
      /* the renderer tracks view-state itself; reserve for future main-side needs */
      void payload
      return { ok: true }
    }
  )

  handleInvoke(IpcChannels.DashboardUpsertProject, async (payload: ProjectUpsertPayload) => {
    await deps.monitorStore.upsertProject(payload)
    return broadcastSnapshot()
  })

  handleInvoke(IpcChannels.DashboardDeleteProject, async (payload: ProjectDeletePayload) => {
    await deps.monitorStore.deleteProject(payload.projectId)
    await deps.aiSettings?.clearProject(payload.projectId)
    return broadcastSnapshot()
  })

  handleInvoke(
    IpcChannels.DashboardSyncNow,
    async (payload: { projectId?: string } | undefined) => {
      if (payload?.projectId) {
        await deps.engine.syncProject(payload.projectId)
      } else {
        await deps.engine.syncAll()
      }
      return broadcastSnapshot()
    }
  )

  handleInvoke(IpcChannels.DashboardGetAppConfig, async () => ({
    clientId: process.env.SLACK_CLIENT_ID ?? '',
    redirectUri: process.env.SLACK_REDIRECT_URI ?? ''
  }))

  handleInvoke(
    IpcChannels.DashboardGetHistory,
    async (payload: { projectId: string }) =>
      (await deps.historyStore?.read(payload.projectId)) ?? []
  )

  handleInvoke(
    IpcChannels.DashboardGetRecent,
    async (): Promise<RecentActivity[]> => (await deps.buildRecent?.()) ?? []
  )

  handleInvoke(IpcChannels.DashboardAddManualToken, async (payload: ManualTokenPayload) => {
    const poller = new SlackPoller()
    let validated = false
    let valid = false
    let error: string | undefined
    let vaultTeamName: string | undefined
    let vaultTeamId: string | undefined
    let vaultUserName: string | undefined
    let vaultUserId: string | undefined
    let vaultScopes: string[] | undefined
    try {
      const check = await poller.authTest(payload.token)
      validated = true
      if (!check.valid) {
        error = check.error ?? 'Slack rejected this token'
      } else {
        const meta =
          check.teamId && check.teamName
            ? {
                teamId: check.teamId,
                teamName: check.teamName,
                userName: check.userName,
                userId: check.userId
              }
            : undefined
        const stored = await deps.monitorStore.saveManualToken(payload.key, payload.token, meta)
        if (!stored.plaintext)
          console.info(`[dashboard] manual token ${payload.key} stored encrypted in vault`)
        valid = true
        if (check.teamName) vaultTeamName = check.teamName
        if (check.teamId) vaultTeamId = check.teamId
        if (check.userName) vaultUserName = check.userName
        if (check.userId) vaultUserId = check.userId
        if (check.scopes) vaultScopes = check.scopes
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'token validation failed'
    }
    const vault: ValidateTokenResultPayload = {
      key: payload.key,
      validated,
      valid,
      error,
      teamId: vaultTeamId,
      teamName: vaultTeamName,
      userName: vaultUserName,
      userId: vaultUserId,
      scopes: vaultScopes
    }
    await broadcastSnapshot()
    return vault
  })

  const onProgress = (payload: DashboardSyncProgressPayload): void => {
    broadcast(IpcChannels.DashboardSyncProgress, payload)
  }

  const unsubscribeProgress = deps.engine.addProgressListener(onProgress)

  // v2.4 — Sidebar state per project
  if (deps.sidebarStateStore) {
    handleInvoke(IpcChannels.DashboardSidebarGet, async (payload: { projectId: string }) =>
      deps.sidebarStateStore!.get(payload.projectId)
    )

    handleInvoke(
      IpcChannels.DashboardSidebarSet,
      async (payload: { projectId: string; state: ProjectSidebarState }) => {
        await deps.sidebarStateStore!.set(payload.projectId, payload.state)
      }
    )

    handleInvoke(
      IpcChannels.DashboardSidebarUpdate,
      async (payload: {
        projectId: string
        sidebar: 'left' | 'right'
        patch: Partial<SidebarState>
      }) => {
        if (payload.sidebar === 'left') {
          return deps.sidebarStateStore!.updateLeft(payload.projectId, payload.patch)
        } else {
          return deps.sidebarStateStore!.updateRight(payload.projectId, payload.patch)
        }
      }
    )
  }

  // v2.6 — Slack Chat tab: local message history + replies (chat.postMessage)
  if (deps.chatService) {
    handleInvoke(
      IpcChannels.DashboardGetMessages,
      async (payload: DashboardChatQueryPayload): Promise<DashboardChatPage> =>
        deps.chatService!.loadMessages(payload)
    )
    handleInvoke(
      IpcChannels.DashboardSendMessage,
      async (payload: DashboardSendMessagePayload): Promise<DashboardSendMessageResult> =>
        deps.chatService!.sendMessage(payload)
    )
    handleInvoke(
      IpcChannels.DashboardChatTokenStatus,
      async (projectId: string): Promise<DashboardChatTokenStatus> =>
        deps.chatService!.chatTokenStatus(projectId)
    )
  }

  // v3 — our team workspace: connect once, pin its channels, every card reads it.
  if (deps.teamWorkspace) {
    const store = deps.teamWorkspace
    handleInvoke(IpcChannels.DashboardTeamWorkspaceGet, async () => store.readPublic())

    handleInvoke(
      IpcChannels.DashboardTeamWorkspaceCandidates,
      async (): Promise<DashboardTeamWorkspaceCandidate[]> =>
        (await deps.listTeamWorkspaceCandidates?.()) ?? []
    )

    handleInvoke(
      IpcChannels.DashboardTeamWorkspaceConnect,
      async (payload: DashboardTeamWorkspaceConnectPayload) => {
        const poller = new SlackPoller()
        let token: string | null = null
        if (payload.source === 'manual') {
          token = payload.token?.trim() ?? null
          if (!token) throw new Error('Paste a Slack token to connect our workspace.')
        } else {
          if (!payload.profileId || !payload.teamId) {
            throw new Error('Pick a workspace to connect.')
          }
          token = await deps.oauthTokenProvider.tryGet(payload.profileId, payload.teamId)
          if (!token) {
            throw new Error('That workspace has no stored token any more. Reconnect it first.')
          }
        }
        // Verify with Slack before storing: a dead token must never look connected.
        const check = await poller.authTest(token)
        if (!check.valid) throw new Error(check.error ?? 'Slack rejected this token')
        const teamId = check.teamId ?? payload.teamId ?? ''
        if (!teamId) throw new Error('Slack did not report a workspace id for this token.')
        return store.connect({
          payload,
          profileId:
            payload.source === 'manual' ? `manual:${teamId}` : (payload.profileId as string),
          teamId,
          teamName: check.teamName ?? teamId,
          token: payload.source === 'manual' ? (token as string) : undefined,
          maskedToken: maskToken(token)
        })
      }
    )

    handleInvoke(
      IpcChannels.DashboardTeamWorkspaceChannels,
      async (payload: DashboardTeamWorkspaceChannelsPayload) => store.setChannels(payload.channels)
    )

    handleInvoke(IpcChannels.DashboardTeamWorkspaceClear, async () => {
      await store.clear()
      return store.readPublic()
    })
  }

  // v2.7 — AI provider settings (keys stay in main; public views are masked)
  if (deps.aiSettings) {
    handleInvoke(
      IpcChannels.DashboardGetAiSettings,
      async (payload?: DashboardAiSettingsQueryPayload): Promise<DashboardAiSettingsView> =>
        deps.aiSettings!.publicView(payload?.projectId)
    )
    handleInvoke(
      IpcChannels.DashboardSaveAiSettings,
      async (payload: DashboardAiSettingsSavePayload): Promise<DashboardAiSettingsView> =>
        deps.aiSettings!.save(payload)
    )
    handleInvoke(
      IpcChannels.DashboardListAiModels,
      async (payload?: DashboardAiModelsQueryPayload): Promise<DashboardAiModelsResult> =>
        deps.aiSettings!.listModels(payload?.projectId)
    )
  }

  return {
    dispose: (): void => {
      unsubscribeProgress()
    }
  }
}
