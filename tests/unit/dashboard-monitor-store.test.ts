import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MonitorStore } from '../../src/main/dashboard/monitor-store'
const fakeVault = { encrypt: (p: string) => Buffer.from(p).toString('base64'), decrypt: (b: string) => Buffer.from(b, 'base64').toString('utf8') }
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
  return new MonitorStore({ rootDir: dir, encryptionAvailable: true, vault: fakeVault })
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

  it('stores manual tokens encrypted when os encryption available', async () => {
    const store = await tmpStore()
    const saved = await store.saveManualToken('DASH_TOKEN_ACME', 'xoxp-000')
    expect(saved.plaintext).toBe(false)
    const token = await store.getManualToken('DASH_TOKEN_ACME')
    expect(token).toBe('xoxp-000')
    const listed = await store.listManualTokens()
    expect(listed).toEqual([{ key: 'DASH_TOKEN_ACME', persisted: true }])
  })

  it('blocks token save when OS encryption unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dash-monitor-'))
    dirs.push(dir)
    const store = new MonitorStore({ rootDir: dir, encryptionAvailable: false })
    await expect(store.saveManualToken('K', 'tok')).rejects.toThrow('OS encryption unavailable')
    expect(await store.getManualToken('K')).toBeNull()
  })

  it('persists sync interval override', async () => {
    const store = await tmpStore()
    expect(await store.syncIntervalSeconds()).toBe(300)
    await store.setSyncIntervalSeconds(120)
    expect(await store.syncIntervalSeconds()).toBe(120)
  })

  it('persists pinned order, ignores unknown ids and cleans deleted projects', async () => {
    const store = await tmpStore()
    const a = await store.upsertProject({ project: { ...project('a'), id: '' } })
    const b = await store.upsertProject({ project: { ...project('b'), id: '' } })
    const c = await store.upsertProject({ project: { ...project('c'), id: '' } })
    expect(await store.setPinnedOrder([b.id, 'missing', a.id, b.id])).toEqual([b.id, a.id])
    expect(await store.readPinnedOrder()).toEqual([b.id, a.id])

    await store.deleteProject(a.id)
    expect(await store.readPinnedOrder()).toEqual([b.id])
    expect((await store.listProjects()).map((p) => p.id)).toEqual([b.id, c.id])
  })
})
