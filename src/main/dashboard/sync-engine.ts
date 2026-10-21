import { SlackPoller } from './slack-poller'
import type {
  DashboardChannelDelta,
  DashboardProject,
  DashboardProjectSnapshot,
  DashboardSyncProgressPayload
} from '../../shared/dashboard-contract'
import type { DashboardDeltaStore, DashboardStoredMessage } from './delta-store'
import type { MonitorStore } from './monitor-store'
import { summarizeProject } from './summary-engine'

export interface DashboardPoller {
  fetchHistory(input: {
    token: string
    channelId: string
    afterTs?: string
    limit?: number
  }): Promise<{ messages: DashboardStoredMessage[]; hasMore: boolean }>
}

export interface OAuthTokenProvider {
  tryGet(profileId: string, teamId: string): Promise<string | null>
}

export interface ManualTokenProvider {
  getManualToken(key: string): Promise<string | null>
}

export interface DashboardSyncEngineDeps {
  monitorStore: MonitorStore
  deltaStore: DashboardDeltaStore
  oauthTokenProvider: OAuthTokenProvider
  manualTokenProvider?: ManualTokenProvider
  pollerFactory?: () => DashboardPoller
  onProgress?: (payload: DashboardSyncProgressPayload) => void
}

export class DashboardSyncEngine {
  private readonly monitorStore: MonitorStore
  private readonly deltaStore: DashboardDeltaStore
  private readonly oauthTokenProvider: OAuthTokenProvider
  private readonly manualTokenProvider?: ManualTokenProvider
  private readonly pollerFactory: () => DashboardPoller
  private readonly progressCallbacks: Array<(payload: DashboardSyncProgressPayload) => void> = []
  /** per-project cached snapshot — rebuilt after any sync */
  private readonly lastResults: Map<string, DashboardProjectSnapshot> = new Map()

  constructor(deps: DashboardSyncEngineDeps) {
    this.monitorStore = deps.monitorStore
    this.deltaStore = deps.deltaStore
    this.oauthTokenProvider = deps.oauthTokenProvider
    this.manualTokenProvider = deps.manualTokenProvider
    this.pollerFactory = deps.pollerFactory ?? (() => new SlackPoller())
    if (deps.onProgress) this.progressCallbacks.push(deps.onProgress)
  }

  /** Register a progress listener (used by the IPC layer). Returns unsubscriber. */
  addProgressListener(cb: (payload: DashboardSyncProgressPayload) => void): () => void {
    this.progressCallbacks.push(cb)
    return () => {
      const idx = this.progressCallbacks.indexOf(cb)
      if (idx >= 0) this.progressCallbacks.splice(idx, 1)
    }
  }

  private emitProgress(payload: DashboardSyncProgressPayload): void {
    for (const cb of this.progressCallbacks) {
      try {
        cb(payload)
      } catch {
        /* listener errors must not break syncing */
      }
    }
  }

  private progress(payload: DashboardSyncProgressPayload): void {
    this.emitProgress(payload)
  }

  private async tokenFor(project: DashboardProject): Promise<string | null> {
    if (project.tokenSource === 'manual') {
      if (!project.manualTokenKey || !this.manualTokenProvider) return null
      return this.manualTokenProvider.getManualToken(project.manualTokenKey)
    }
    return this.oauthTokenProvider.tryGet(project.profileId, project.teamId)
  }

  /** Pull new messages for every monitored channel and append to the store. */
  private async syncCore(
    project: DashboardProject,
    token: string
  ): Promise<DashboardChannelDelta[]> {
    const poller = this.pollerFactory()
    const perChannel: DashboardChannelDelta[] = []

    for (const monitor of project.monitors) {
      const before = await this.deltaStore.readSnapshotMeta(
        project.profileId,
        project.teamId,
        monitor.channelId
      )
      const cursor = before?.cursor

      const result = await poller.fetchHistory({
        token,
        channelId: monitor.channelId,
        afterTs: cursor,
        limit: 200
      })

      const stored = await this.deltaStore.appendMessages({
        profileId: project.profileId,
        teamId: project.teamId,
        channelId: monitor.channelId,
        channelName: monitor.channelName,
        messages: result.messages
      })

      const after = await this.deltaStore.readSnapshotMeta(
        project.profileId,
        project.teamId,
        monitor.channelId
      )

      perChannel.push({
        channelId: monitor.channelId,
        channelName: monitor.channelName,
        messageCount: after?.messageCount ?? stored.added,
        latestMessageAt: new Date(Number(stored.cursor) * 1000).toISOString(),
        cursor: stored.cursor,
        lastSyncAt: stored.lastSyncAt
      })
    }
    return perChannel
  }

  private perChannelDelta(delta: {
    channel: { id: string; name: string }
    messages: DashboardStoredMessage[]
    cursor: string
    lastSyncAt: string
  }): DashboardChannelDelta {
    return {
      channelId: delta.channel.id,
      channelName: delta.channel.name,
      messageCount: delta.messages.length,
      latestMessageAt: new Date(Number(delta.cursor) * 1000).toISOString(),
      cursor: delta.cursor,
      lastSyncAt: delta.lastSyncAt
    }
  }

  async syncProject(projectId: string): Promise<DashboardProjectSnapshot | null> {
    const projects = await this.monitorStore.listProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return null

    this.progress({
      syncing: true,
      projectId,
      current: 1,
      total: 1,
      phase: 'syncing',
      projectIds: [projectId]
    })

    try {
      const token = await this.tokenFor(project)
      if (!token) {
        throw new Error(
          project.tokenSource === 'manual'
            ? 'No manual token saved for this project yet'
            : 'Workspace not connected via OAuth yet'
        )
      }
      const perChannel = await this.syncCore(project, token)
      const messages = await this.collectMessages(project)
      const snapshot = summarizeProject({
        project,
        messages,
        netNewCount: perChannel.reduce(
          (acc, ch) =>
            acc +
            Math.max(
              0,
              ch.messageCount -
                (this.lastResults
                  .get(project.id)
                  ?.perChannel.find((c) => c.channelId === ch.channelId)?.messageCount ??
                  ch.messageCount)
            ),
          0
        ),
        perChannel,
        lastUpdatedAt: new Date().toISOString()
      })
      this.lastResults.set(project.id, snapshot)
      this.progress({
        syncing: false,
        projectId,
        current: 1,
        total: 1,
        phase: 'complete',
        projectIds: [projectId]
      })
      return snapshot
    } catch (err) {
      const hint = err instanceof Error ? err.message : 'sync failed'
      const perChannel = await this.storedDeltas(project)
      const base = this.buildFallbackSnapshot(project, perChannel)
      base.syncState = 'error'
      base.mood = { state: 'neutral', signal: hint }
      this.lastResults.set(project.id, base)
      this.progress({
        syncing: false,
        projectId,
        current: 1,
        total: 1,
        phase: 'error',
        projectIds: [projectId],
        message: hint
      })
      return base
    }
  }

  async syncAll(): Promise<DashboardProjectSnapshot[]> {
    const projects = await this.monitorStore.listProjects()
    const results: DashboardProjectSnapshot[] = []
    for (const project of projects) {
      const snap = await this.syncProject(project.id)
      if (snap) results.push(snap)
    }
    return results
  }

  /** Snapshot straight from stored data (no network). */
  async buildSnapshot(projectId?: string): Promise<DashboardProjectSnapshot[]> {
    const projects = await this.monitorStore.listProjects()
    const target = projectId ? projects.filter((p) => p.id === projectId) : projects
    const out: DashboardProjectSnapshot[] = []
    for (const project of target) {
      const cached = this.lastResults.get(project.id)
      if (cached) {
        out.push(cached)
        continue
      }
      const perChannel = await this.storedDeltas(project)
      out.push(this.buildFallbackSnapshot(project, perChannel))
    }
    return out
  }

  private async storedDeltas(project: DashboardProject): Promise<DashboardChannelDelta[]> {
    const loaded: Array<{
      channel: { id: string; name: string }
      messages: DashboardStoredMessage[]
      cursor: string
      lastSyncAt: string
    } | null> = []

    for (const monitor of project.monitors) {
      const d = await this.deltaStore.load(project.profileId, project.teamId, monitor.channelId)
      if (d) loaded.push(d)
    }
    return loaded.filter(Boolean).map((d) => this.perChannelDelta(d as NonNullable<typeof d>))
  }

  private buildFallbackSnapshot(
    project: DashboardProject,
    perChannel: DashboardChannelDelta[]
  ): DashboardProjectSnapshot {
    const summarySource: DashboardStoredMessage[] = perChannel.map((c) => ({
      ts: (Number(new Date(c.latestMessageAt).getTime()) / 1000).toFixed(6),
      text: ''
    }))
    void summarySource
    return summarizeProject({
      project,
      messages: [],
      netNewCount: 0,
      perChannel,
      lastUpdatedAt: perChannel[0]?.lastSyncAt ?? null
    })
  }

  private async collectMessages(project: DashboardProject): Promise<DashboardStoredMessage[]> {
    const out: DashboardStoredMessage[] = []
    for (const monitor of project.monitors) {
      const messages = await this.deltaStore.messagesSince(
        project.profileId,
        project.teamId,
        monitor.channelId
      )
      out.push(...messages)
    }
    return out
  }
}
