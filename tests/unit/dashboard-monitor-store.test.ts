import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MonitorStore } from '../../src/main/dashboard/monitor-store'
import type { DashboardProject } from '../../src/shared/dashboard-contract'

const dirs: string[] = []
const project = (id: string, overrides: Record<string, unknown> = {}): DashboardProject => ({
  id,
  name: `Project ${id}`,
  clientName: 'Bob',
  profileId: 'pf1',
  teamId: 't1',
  appId: 'slack' as const,
  tokenSource: 'oauth' as const,
  monitors: [{ channelId: 'c1', channelName: 'acme' }],
  createdAt: new Date().toISOString(),
  ...overrides
})

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true }).catch(() => {})))
  dirs.length = 0
})

async function tmpStore(): Promise<MonitorStore> {
  const dir = await mkdtemp(join(tmpdir(), 'dash-monitor-'))
  dirs.push(dir)
  return new MonitorStore({ rootDir: dir, encryptionAvailable: false })
}

describe('MonitorStore', () => {
  it('creates, replaces (upsert by id), deletes projects', async () => {
    const store = await tmpStore()
    await store.upsertProject({ project: { ...project('a'), id: '' } })
    let projects = await store.listProjects()
    expect(projects).toHaveLength(1)
    const id = projects[0].id

    await store.upsertProject({ project: { ...project('a'), id, name: 'Renamed' } })
    projects = await store.listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Renamed')

    await store.deleteProject(id)
    expect(await store.listProjects()).toHaveLength(0)
  })

  it('stores manual tokens (plaintext fallback when os encryption na)', async () => {
    const store = await tmpStore()
    const saved = await store.saveManualToken('DASH_TOKEN_ACME', 'xoxp-000')
    expect(saved.plaintext).toBe(true)
    const token = await store.getManualToken('DASH_TOKEN_ACME')
    expect(token).toBe('xoxp-000')
    const listed = await store.listManualTokens()
    expect(listed).toEqual([{ key: 'DASH_TOKEN_ACME', persisted: true }])
  })

  it('persists sync interval override', async () => {
    const store = await tmpStore()
    expect(await store.syncIntervalSeconds()).toBe(300)
    await store.setSyncIntervalSeconds(120)
    expect(await store.syncIntervalSeconds()).toBe(120)
  })
})
