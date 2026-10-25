import { SlackPoller } from './slack-poller'
import type { InsightEngine } from './insight-engine'
import type {
  DashboardChannelDelta,
  DashboardMonitor,
  DashboardProject,
  DashboardProjectSnapshot,
  DashboardSource,
  DashboardSyncProgressPayload,
  ProjectInsight
} from '../../shared/dashboard-contract'
import type { DashboardDeltaStore, DashboardStoredMessage } from './delta-store'
import type { InsightHistoryEntry } from './history-store'
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

/** The one team workspace shared by every card (ticket 04). */
export interface TeamWorkspaceReader {
  getConnection(): Promise<{
    profileId: string
    teamId: string
    token: string | null
    channels: DashboardMonitor[]
  } | null>
}

/** One workspace a sync run has to read. */
interface SyncWorkspace {
  source: DashboardSource
  profileId: string
  teamId: string
  token: string
  monitors: DashboardMonitor[]
}

/** The same workspace without a token — enough to read what is already stored. */
interface StoredWorkspace {
  source: DashboardSource
  profileId: string
  teamId: string
  monitors: DashboardMonitor[]
}

/** v2.3 — lets the engine show the last AI insight without a network sync. */
export interface InsightReader {
  getLastInsight: (projectId: string) => Promise<ProjectInsight | null>
  getLastEntry: (projectId: string) => Promise<InsightHistoryEntry | null>
}

export interface DashboardSyncEngineDeps {
  monitorStore: MonitorStore
  deltaStore: DashboardDeltaStore
  oauthTokenProvider: OAuthTokenProvider
  manualTokenProvider?: ManualTokenProvider
  /** v3 — our team workspace (optional; a card still syncs its client workspace alone). */
  teamWorkspace?: TeamWorkspaceReader
  pollerFactory?: () => DashboardPoller
  onProgress?: (payload: DashboardSyncProgressPayload) => void
  /** diagnostics (never secrets) */
  log?: (msg: string) => void
  /** v2.3 — read-only access to the stored insights (cold start) */
  insightReader?: InsightReader
  /** v2.3 — called after a background sync (e.g. to refresh the digest) */
  onSynced?: (snapshots: DashboardProjectSnapshot[]) => void
}

export class DashboardSyncEngine {
  protected readonly monitorStore: MonitorStore
  private readonly deltaStore: DashboardDeltaStore
  private readonly oauthTokenProvider: OAuthTokenProvider
  private readonly manualTokenProvider?: ManualTokenProvider
  private readonly teamWorkspace: TeamWorkspaceReader | undefined
  private readonly pollerFactory: () => DashboardPoller
  private readonly log: (msg: string) => void
  private readonly insightReader: InsightReader | undefined
  private readonly onSynced: ((snapshots: DashboardProjectSnapshot[]) => void) | undefined
  private readonly progressCallbacks: Array<(payload: DashboardSyncProgressPayload) => void> = []
  /** per-project cached snapshot — rebuilt after any sync */
  private readonly lastResults: Map<string, DashboardProjectSnapshot> = new Map()

  constructor(deps: DashboardSyncEngineDeps) {
    this.monitorStore = deps.monitorStore
    this.deltaStore = deps.deltaStore
    this.oauthTokenProvider = deps.oauthTokenProvider
    this.manualTokenProvider = deps.manualTokenProvider
    this.teamWorkspace = deps.teamWorkspace
    this.pollerFactory = deps.pollerFactory ?? (() => new SlackPoller())
    this.log = deps.log ?? (() => undefined)
    this.insightReader = deps.insightReader
    this.onSynced = deps.onSynced
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

  /** protected so subclasses can report diagnostics */
  protected logInfo(msg: string): void {
    this.log(msg)
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

  protected async tokenFor(project: DashboardProject): Promise<string | null> {
    if (project.tokenSource === 'manual') {
      if (!project.manualTokenKey || !this.manualTokenProvider) return null
      return this.manualTokenProvider.getManualToken(project.manualTokenKey)
    }
    return this.oauthTokenProvider.tryGet(project.profileId, project.teamId)
  }

  /** Pull new messages for every channel of one workspace and append them. */
  private async syncWorkspace(
    workspace: SyncWorkspace,
    poller: DashboardPoller
  ): Promise<DashboardChannelDelta[]> {
    const perChannel: DashboardChannelDelta[] = []

    for (const monitor of workspace.monitors) {
      const before = await this.deltaStore.readSnapshotMeta(
        workspace.profileId,
        workspace.teamId,
        monitor.channelId
      )
      const cursor = before?.cursor

      const result = await poller.fetchHistory({
        token: workspace.token,
        channelId: monitor.channelId,
        afterTs: cursor,
        limit: 200
      })

      const stored = await this.deltaStore.appendMessages({
        profileId: workspace.profileId,
        teamId: workspace.teamId,
        channelId: monitor.channelId,
        channelName: monitor.channelName,
        messages: result.messages,
        source: workspace.source
      })

      const after = await this.deltaStore.readSnapshotMeta(
        workspace.profileId,
        workspace.teamId,
        monitor.channelId
      )

      perChannel.push({
        channelId: monitor.channelId,
        channelName: monitor.channelName,
        source: workspace.source,
        messageCount: after?.messageCount ?? stored.added,
        newMessageCount: stored.added,
        latestMessageAt: new Date(Number(stored.cursor) * 1000).toISOString(),
        cursor: stored.cursor,
        lastSyncAt: stored.lastSyncAt
      })
    }
    return perChannel
  }

  /** Read our team workspace without throwing: a missing one is simply absent. */
  private async ourWorkspace(): Promise<{
    connection: {
      profileId: string
      teamId: string
      token: string | null
      channels: DashboardMonitor[]
    } | null
    error: string | null
  }> {
    if (!this.teamWorkspace) return { connection: null, error: null }
    try {
      return { connection: await this.teamWorkspace.getConnection(), error: null }
    } catch (err) {
      return {
        connection: null,
        error: err instanceof Error ? err.message : 'could not read our workspace'
      }
    }
  }

  /** Workspaces this card reads: its own (always) and ours (when connected). */
  private async storedWorkspaces(
    project: DashboardProject
  ): Promise<{ workspaces: StoredWorkspace[]; error: string | null }> {
    const workspaces: StoredWorkspace[] = [
      {
        source: 'client',
        profileId: project.profileId,
        teamId: project.teamId,
        monitors: project.monitors
      }
    ]
    const { connection, error } = await this.ourWorkspace()
    if (connection && connection.channels.length > 0) {
      workspaces.push({
        source: 'ours',
        profileId: connection.profileId,
        teamId: connection.teamId,
        monitors: connection.channels
      })
    }
    return { workspaces, error }
  }

  private perChannelDelta(
    delta: {
      channel: { id: string; name: string }
      messages: DashboardStoredMessage[]
      cursor: string
      lastSyncAt: string
    },
    source: DashboardSource
  ): DashboardChannelDelta {
    return {
      channelId: delta.channel.id,
      channelName: delta.channel.name,
      source,
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
      const poller = this.pollerFactory()
      const clientDeltas = await this.syncWorkspace(
        {
          source: 'client',
          profileId: project.profileId,
          teamId: project.teamId,
          token,
          monitors: project.monitors
        },
        poller
      )

      // Our team workspace is additive: if it fails, the client sync still
      // counts and the card keeps showing the data it already had.
      let ourDeltas: DashboardChannelDelta[] = []
      let ourWorkspaceError: string | null = null
      const { connection, error: readError } = await this.ourWorkspace()
      if (readError) ourWorkspaceError = readError
      if (connection) {
        if (!connection.token) {
          ourWorkspaceError =
            'Our team workspace has no usable token. Reconnect it in Global settings.'
        } else if (connection.channels.length > 0) {
          try {
            ourDeltas = await this.syncWorkspace(
              {
                source: 'ours',
                profileId: connection.profileId,
                teamId: connection.teamId,
                token: connection.token,
                monitors: connection.channels
              },
              poller
            )
          } catch (err) {
            ourWorkspaceError = err instanceof Error ? err.message : 'our workspace sync failed'
            this.log(`[dashboard] our-workspace sync failed: ${ourWorkspaceError}`)
          }
        }
      }

      const perChannel = [...clientDeltas, ...ourDeltas]
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
      snapshot.ourWorkspaceError = ourWorkspaceError
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
      this.log(`[dashboard] sync failed (${project.name}): ${hint}`)
      const perChannel = await this.storedDeltas(project)
      const base = this.buildFallbackSnapshot(
        project,
        perChannel,
        await this.collectMessages(project)
      )
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
    try {
      this.onSynced?.(results)
    } catch (err) {
      this.logInfo(`[dashboard] post-sync hook failed: ${String(err)}`)
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
        // the cached snapshot may predate the latest insight (the enrich
        // step runs after the cache is written) — always refresh it. The
        // project record can also change (dates, completion, channels), so
        // re-derive the fields that depend on it.
        const refreshed: DashboardProjectSnapshot = {
          ...cached,
          project,
          effectiveDates: {
            startDate: project.startDate ?? cached.extractedDates?.startDate,
            endDate: project.endDate ?? cached.extractedDates?.endDate
          },
          completion: project.manualCompletion ?? cached.completion
        }
        out.push(await this.attachLastInsight(project, refreshed))
        continue
      }
      const perChannel = await this.storedDeltas(project)
      // cold start: summarize what is ALREADY stored, so the card is never
      // blank while waiting for the first network sync
      const messages = await this.collectMessages(project)
      const snapshot = this.buildFallbackSnapshot(project, perChannel, messages)
      out.push(await this.attachLastInsight(project, snapshot))
    }
    return out
  }

  /** v2.3 — the AI insight is shown even before the first sync of the session. */
  private async attachLastInsight(
    project: DashboardProject,
    snapshot: DashboardProjectSnapshot
  ): Promise<DashboardProjectSnapshot> {
    if (!this.insightReader) return snapshot
    try {
      const insight = await this.insightReader.getLastInsight(project.id)
      if (!insight) return snapshot
      const entry = await this.insightReader.getLastEntry(project.id)
      return {
        ...snapshot,
        insight,
        insightUpdatedAt: entry?.atIso ?? null,
        insightSource: entry?.source ?? null,
        insightModel: entry?.model ?? null
      }
    } catch (err) {
      this.logInfo(
        `[dashboard] could not load the stored insight for ${project.name}: ${String(err)}`
      )
      return snapshot
    }
  }

  /** how many messages the last sync added (activity signal for the feed) */
  newMessageCountFor(projectId: string): number {
    return this.lastResults.get(projectId)?.newMessageCount ?? 0
  }

  private async storedDeltas(project: DashboardProject): Promise<DashboardChannelDelta[]> {
    const { workspaces } = await this.storedWorkspaces(project)
    const out: DashboardChannelDelta[] = []

    for (const workspace of workspaces) {
      for (const monitor of workspace.monitors) {
        const d = await this.deltaStore.load(
          workspace.profileId,
          workspace.teamId,
          monitor.channelId
        )
        if (d) out.push(this.perChannelDelta(d, workspace.source))
      }
    }
    return out
  }

  private buildFallbackSnapshot(
    project: DashboardProject,
    perChannel: DashboardChannelDelta[],
    messages: DashboardStoredMessage[] = []
  ): DashboardProjectSnapshot {
    return summarizeProject({
      project,
      messages,
      netNewCount: 0,
      perChannel,
      lastUpdatedAt: perChannel[0]?.lastSyncAt ?? null
    })
  }

  private async collectMessages(project: DashboardProject): Promise<DashboardStoredMessage[]> {
    const { workspaces } = await this.storedWorkspaces(project)
    const out: DashboardStoredMessage[] = []
    for (const workspace of workspaces) {
      for (const monitor of workspace.monitors) {
        const messages = await this.deltaStore.messagesSince(
          workspace.profileId,
          workspace.teamId,
          monitor.channelId
        )
        for (const message of messages) {
          out.push(message.source ? message : { ...message, source: workspace.source })
        }
      }
    }
    return out
  }
}

/**
 * v2.2 subclass — identical behavior plus an optional post-sync insight
 * refresh (NVIDIA NIM). Additive: base engine stays untouched.
 */
export class DashboardInsightSyncEngine extends DashboardSyncEngine {
  private insightEngine: InsightEngine | null

  constructor(deps: DashboardSyncEngineDeps & { insightEngine?: InsightEngine | null }) {
    super(deps)
    if (deps.insightEngine) {
      this.insightEngine = deps.insightEngine
    } else {
      this.insightEngine = null
    }
  }

  /** attach insights later (e.g. after env key detected) */
  setInsightEngine(engine: InsightEngine | null): void {
    this.insightEngine = engine
  }

  private async enrich(
    project: DashboardProject,
    snapshot: DashboardProjectSnapshot,
    token: string
  ): Promise<DashboardProjectSnapshot> {
    if (!this.insightEngine) return snapshot
    try {
      return await this.insightEngine.refresh(project, token, snapshot)
    } catch {
      return snapshot
    }
  }

  override async syncProject(projectId: string): Promise<DashboardProjectSnapshot | null> {
    const snapshot = await super.syncProject(projectId)
    if (!snapshot || !this.insightEngine) return snapshot
    const projects = await this.monitorStore.listProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return snapshot
    const token = await this.tokenFor(project)
    if (!token) {
      this.logInfo(`[dashboard] no token for ${project.name} — insight refresh skipped`)
      return snapshot
    }
    return await this.enrich(project, snapshot, token)
  }
}
