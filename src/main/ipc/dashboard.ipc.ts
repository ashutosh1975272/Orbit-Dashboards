import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-contract'
import type {
  DashboardManualToken,
  DashboardSnapshot,
  DashboardSyncProgressPayload,
  ManualTokenPayload,
  ProjectDeletePayload,
  ProjectUpsertPayload,
  RecentActivity,
  ValidateTokenResultPayload,
  ProjectSidebarState,
  SidebarState
} from '../../shared/dashboard-contract'
import type { DashboardSyncEngine } from '../dashboard/sync-engine'
import type { DashboardScheduler } from '../dashboard/scheduler'
import type { MonitorStore } from '../dashboard/monitor-store'
import { SlackPoller } from '../dashboard/slack-poller'
import { listChannels } from '../slack/slack-api-client'
import type { SlackChannelSummary } from '../../shared/types'
import { handleInvoke } from './handle'
import type { HistoryStore } from '../dashboard/history-store'
import type { DashboardSidebarStateStore } from '../dashboard/sidebar-state'

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
      syncIntervalSeconds: await deps.monitorStore.syncIntervalSeconds(),
      digest: deps.getDigest ? await deps.getDigest() : null
    }
  }

  handleInvoke(IpcChannels.DashboardGetSnapshot, async () => publicSnapshot())

  handleInvoke(
    IpcChannels.DashboardListChannels,
    async (payload: {
      tokenSource: 'oauth' | 'manual'
      profileId?: string
      teamId?: string
      manualTokenKey?: string
    }): Promise<SlackChannelSummary[]> => {
      let token: string | null = null
      if (payload.tokenSource === 'manual') {
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
    handleInvoke(
      IpcChannels.DashboardSidebarGet,
      async (payload: { projectId: string }) => deps.sidebarStateStore!.get(payload.projectId)
    )

    handleInvoke(
      IpcChannels.DashboardSidebarSet,
      async (payload: { projectId: string; state: ProjectSidebarState }) => {
        await deps.sidebarStateStore!.set(payload.projectId, payload.state)
      }
    )

    handleInvoke(
      IpcChannels.DashboardSidebarUpdate,
      async (payload: { projectId: string; sidebar: 'left' | 'right'; patch: Partial<SidebarState> }) => {
        if (payload.sidebar === 'left') {
          return deps.sidebarStateStore!.updateLeft(payload.projectId, payload.patch)
        } else {
          return deps.sidebarStateStore!.updateRight(payload.projectId, payload.patch)
        }
      }
    )
  }

  return {
    dispose: (): void => {
      unsubscribeProgress()
    }
  }
}
