/** InsightEngine (v2.2): after every successful sync of a project, merge
 * ONLY the new messages (ts > last summarized cursor) with the previous
 * insight through NVIDIA NIM, append the result to the timestamped history,
 * and stamp it onto the snapshot. Falls back to heuristic-only behavior
 * whenever the provider is missing or fails. */

import { NimProvider } from './ai-provider'
import { buildInsightMessages, mergeInsight } from './insights'
import { buildHeuristicInsight } from './heuristic-insight'
import type { InsightChatMessageInput } from './insights'
import type {
  DashboardProject,
  DashboardProjectSnapshot,
  ProjectInsight
} from '../../shared/dashboard-contract'
import type { DashboardDeltaStore, DashboardStoredMessage } from './delta-store'
import type { HistoryStore, InsightHistoryEntry } from './history-store'
import { compareTs } from './delta-store'

export interface InsightEngineDeps {
  provider: NimProvider | null
  historyStore: HistoryStore
  deltaStore: DashboardDeltaStore
  /** users.list per token — name mapping for prompts (best effort). */
  fetchUsers?: (token: string) => Promise<Map<string, string>>
  /** log fn for observability */
  log?: (msg: string) => void
}

/** Trigger thresholds: small trickle waits for a 30-min heartbeat. */
const MIN_NEW_FOR_IMMEDIATE = 3
const HEARTBEAT_MINUTES = 30

export class InsightEngine {
  private readonly provider: NimProvider | null
  private readonly historyStore: HistoryStore
  private readonly deltaStore: DashboardDeltaStore
  private readonly fetchUsers: (token: string) => Promise<Map<string, string>>
  private readonly log: (msg: string) => void

  constructor(deps: InsightEngineDeps) {
    this.provider = deps.provider
    this.historyStore = deps.historyStore
    this.deltaStore = deps.deltaStore
    this.fetchUsers = deps.fetchUsers ?? (async () => new Map())
    this.log = deps.log ?? (() => undefined)
  }

  async existingInsight(projectId: string): Promise<ProjectInsight | null> {
    const entries = await this.historyStore.read(projectId)
    const last = entries[0]?.insight
    return last ?? null
  }

  async history(projectId: string): Promise<InsightHistoryEntry[]> {
    return this.historyStore.read(projectId)
  }

  /** Collect stored messages newer than the summarize cursor (per project). */
  private async newMessagesFor(
    project: DashboardProject,
    sinceTs: string
  ): Promise<Array<{ msg: DashboardStoredMessage; channel: string }>> {
    const out: Array<{ msg: DashboardStoredMessage; channel: string }> = []
    for (const monitor of project.monitors) {
      const delta = await this.deltaStore.load(project.profileId, project.teamId, monitor.channelId)
      for (const msg of delta?.messages ?? []) {
        if (compareTs(msg.ts, sinceTs) > 0 && !msg.subtype && (msg.text ?? '').trim()) {
          out.push({ msg, channel: monitor.channelName })
        }
      }
    }
    out.sort((a, b) => compareTs(a.msg.ts, b.msg.ts))
    return out
  }

  private toChatInput(
    raw: Array<{ msg: DashboardStoredMessage; channel: string }>,
    userNames: Map<string, string>,
    project: DashboardProject
  ): InsightChatMessageInput[] {
    const clientNames = new Set(
      [project.clientName.toLowerCase(), 'client'].filter((n) => n.length >= 3)
    )
    return raw.map(({ msg, channel }) => {
      const who = (msg.user && userNames.get(msg.user)) || msg.user || 'unknown'
      // "the client" = anybody who is not the token owner (the freelancer)
      const isClient = Boolean(
        msg.user &&
        (project.selfUserId ? msg.user !== project.selfUserId : clientNames.has(who.toLowerCase()))
      )
      return {
        ts: new Date(Number(msg.ts) * 1000).toISOString(),
        who,
        text: (msg.text ?? '').slice(0, 400),
        isClient,
        channel
      }
    })
  }

  /** Refresh the insight for one project (post-sync). Returns updated snapshot. */
  async refresh(
    project: DashboardProject,
    token: string,
    baseSnapshot: DashboardProjectSnapshot
  ): Promise<DashboardProjectSnapshot> {
    const entries = await this.historyStore.read(project.id)
    const lastEntry = entries[0]
    const sinceTs = lastEntry?.cursorAtSummarize ?? '0'

    const raw = await this.newMessagesFor(project, sinceTs)
    const newCount = raw.length
    const previous = await this.existingInsight(project.id)

    let source: 'ai' | 'heuristic' | null = null
    let modelUsed: string | null = null
    let merged: ProjectInsight | null = null

    if (this.provider) {
      if (newCount > 0) {
        const minutesSince = lastEntry
          ? (Date.now() - new Date(lastEntry.atIso).getTime()) / 60_000
          : Infinity
        const due = newCount >= MIN_NEW_FOR_IMMEDIATE || minutesSince >= HEARTBEAT_MINUTES
        if (due) {
          try {
            const userNames = await this.fetchUsers(token)
            const chatInput = this.toChatInput(raw, userNames, project)
            const messages = buildInsightMessages({
              projectName: project.name,
              workspaceName: project.teamName ?? project.teamId,
              clientName: project.clientName,
              previous,
              newMessages: chatInput,
              newCount
            })
            const res = await this.provider.chatJson(messages, { temperature: 0.2 })
            // only quotes that really exist in the chat may reach the card
            const quotes = chatInput.map((m) => m.text)
            merged = mergeInsight(res.data, previous, quotes)
            modelUsed = res.modelUsed
            source = 'ai'
            this.log(
              `[dashboard] insight refreshed (${project.name}) model=${modelUsed} new=${newCount}`
            )
          } catch (err) {
            this.log(
              `[dashboard] insight failed (${project.name}): ${
                err instanceof Error ? err.message : String(err)
              } — using heuristics`
            )
            merged = buildHeuristicInsight(baseSnapshot)
            source = 'heuristic'
          }
        }
      }
    } else if (newCount > 0 || !previous) {
      // no NVIDIA NIM configured — keep the card meaningful with local heuristics
      merged = buildHeuristicInsight(baseSnapshot)
      source = 'heuristic'
    }

    // the status transition is computed locally — the model may forget it
    if (merged && previous && merged.status !== previous.status) {
      merged = { ...merged, statusChange: `${previous.status} → ${merged.status}` }
    }

    let insightUpdatedAtIso: string | null = null
    if (merged && source) {
      const list = await this.historyStore.append(project.id, {
        atIso: new Date().toISOString(),
        newMessageCount: newCount,
        insight: merged,
        source,
        model: modelUsed ?? undefined,
        previousStatus: previous?.status,
        cursorAtSummarize: raw.at(-1)?.msg.ts ?? sinceTs
      })
      insightUpdatedAtIso = list[0]?.atIso ?? null
    }

    const current = merged ?? previous
    if (!current) return baseSnapshot
    return {
      ...baseSnapshot,
      insight: current,
      insightUpdatedAt: insightUpdatedAtIso ?? lastEntry?.atIso ?? null,
      insightModel: modelUsed,
      insightSource: source ?? lastEntry?.source ?? null,
      newSinceLastInsight: source ? 0 : newCount
    }
  }
}
