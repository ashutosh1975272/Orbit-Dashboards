import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RunLogStore, type RunLogEntry } from '../../src/main/dashboard/run-log-store'

describe('Scheduler & Run Log Store (SLK-3)', () => {
  let dir: string
  let logStore: RunLogStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orbit-run-logs-'))
    logStore = new RunLogStore({ rootDir: dir })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('appends and reads back run log entries in reverse chronological order', async () => {
    const entry1: RunLogEntry = {
      runId: 'run-1',
      ts: new Date(Date.now() - 60000).toISOString(),
      trigger: 'scheduled',
      projectId: 'proj_1',
      sourceId: 'src_1',
      sourceKind: 'browser',
      workspaceId: 'T123',
      channelsRead: 2,
      newMessages: 5,
      durationMs: 1200,
      llmCalls: 1,
      status: 'connected'
    }

    const entry2: RunLogEntry = {
      runId: 'run-2',
      ts: new Date().toISOString(),
      trigger: 'manual',
      projectId: 'proj_1',
      sourceId: 'src_1',
      sourceKind: 'browser',
      workspaceId: 'T123',
      channelsRead: 2,
      newMessages: 0,
      skippedReason: 'No unread messages',
      durationMs: 400,
      llmCalls: 0,
      status: 'connected'
    }

    await logStore.append(entry1)
    await logStore.append(entry2)

    const logs = await logStore.read('proj_1')
    expect(logs).toHaveLength(2)
    expect(logs[0]!.runId).toBe('run-2')
    expect(logs[1]!.runId).toBe('run-1')
    expect(logs[0]!.llmCalls).toBe(0)
    expect(logs[0]!.skippedReason).toBe('No unread messages')
  })

  it('returns empty array when no log exists for project', async () => {
    const logs = await logStore.read('proj_nonexistent')
    expect(logs).toEqual([])
  })
})
