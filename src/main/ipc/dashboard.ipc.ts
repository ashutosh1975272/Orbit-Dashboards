import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-contract'
import type {
  DashboardManualToken,
  DashboardSnapshot,
  DashboardSyncProgressPayload,
  ManualTokenPayload,
  ProjectDeletePayload,
  ProjectUpsertPayload,
  ValidateTokenResultPayload
} from '../../shared/dashboard-contract'
import type { DashboardSyncEngine } from '../dashboard/sync-engine'
import type { DashboardScheduler } from '../dashboard/scheduler'
import type { MonitorStore } from '../dashboard/monitor-store'
import { SlackPoller } from '../dashboard/slack-poller'
import { listChannels } from '../slack/slack-api-client'
import type { SlackChannelSummary } from '../../shared/types'
import { handleInvoke } from './handle'
import type { HistoryStore } from '../dashboard/history-store'

export interface DashboardIpcDeps {
  monitorStore: MonitorStore
  engine: DashboardSyncEngine
  scheduler: DashboardScheduler
  getMainWindow: () => BrowserWindow | null
  oauthTokenProvider: { tryGet(profileId: string, teamId: string): Promise<string | null> }
  /** v2.2 — insight history (optional, additive) */
  historyStore?: HistoryStore
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
      syncIntervalSeconds: await deps.monitorStore.syncIntervalSeconds()
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

  handleInvoke(IpcChannels.DashboardAddManualToken, async (payload: ManualTokenPayload) => {
    const poller = new SlackPoller()
    let validated = false
    let valid = false
    let error: string | undefined
    let vaultTeamName: string | undefined
    let vaultTeamId: string | undefined
    let vaultUserName: string | undefined
    let vaultScopes: string[] | undefined
    try {
      const check = await poller.authTest(payload.token)
      validated = true
      if (!check.valid) {
        error = check.error ?? 'Slack rejected this token'
      } else {
        const meta =
          check.teamId && check.teamName
            ? { teamId: check.teamId, teamName: check.teamName, userName: check.userName }
            : undefined
        const stored = await deps.monitorStore.saveManualToken(payload.key, payload.token, meta)
        if (!stored.plaintext)
          console.info(`[dashboard] manual token ${payload.key} stored encrypted in vault`)
        valid = true
        if (check.teamName) vaultTeamName = check.teamName
        if (check.teamId) vaultTeamId = check.teamId
        if (check.userName) vaultUserName = check.userName
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
      scopes: vaultScopes
    }
    await broadcastSnapshot()
    return vault
  })

  const onProgress = (payload: DashboardSyncProgressPayload): void => {
    broadcast(IpcChannels.DashboardSyncProgress, payload)
  }

  const unsubscribeProgress = deps.engine.addProgressListener(onProgress)

  return {
    dispose: (): void => {
      unsubscribeProgress()
    }
  }
}
