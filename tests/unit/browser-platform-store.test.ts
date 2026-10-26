import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BROWSER_PLATFORM_PRESETS,
  BrowserPlatformStore
} from '../../src/main/browser-sources/browser-platform-store'

describe('BrowserPlatformStore (BS-2)', () => {
  let dir: string
  let store: BrowserPlatformStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orbit-browser-platforms-'))
    store = new BrowserPlatformStore({ rootDir: dir })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('lists empty platforms initially', async () => {
    const list = await store.list()
    expect(list).toEqual([])
  })

  it('provides known platform presets', () => {
    expect(BROWSER_PLATFORM_PRESETS.slack.url).toBe('https://app.slack.com/client/')
    expect(BROWSER_PLATFORM_PRESETS.teams.url).toBe('https://teams.microsoft.com/v2/')
    expect(BROWSER_PLATFORM_PRESETS.whatsapp.url).toBe('https://web.whatsapp.com/')
    expect(BROWSER_PLATFORM_PRESETS.upwork.url).toBe('https://www.upwork.com/messages/')
  })

  it('adds a preset platform with isolated partition', async () => {
    const slack = await store.add({
      name: 'Client Slack',
      type: 'slack',
      url: BROWSER_PLATFORM_PRESETS.slack.url
    })

    expect(slack.id).toMatch(/^slack-/)
    expect(slack.name).toBe('Client Slack')
    expect(slack.type).toBe('slack')
    expect(slack.partition).toBe(`persist:bs-${slack.id}`)
    expect(slack.authStatus).toBe('needs_login')
    expect(slack.order).toBe(0)

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(slack.id)
  })

  it('adds a custom HTTPS platform', async () => {
    const custom = await store.add({
      name: 'Acme Portal',
      type: 'custom',
      url: 'https://portal.acme.corp/messages'
    })

    expect(custom.type).toBe('custom')
    expect(custom.custom).toBe(true)
    expect(custom.url).toBe('https://portal.acme.corp/messages')

    const retrieved = await store.get(custom.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.name).toBe('Acme Portal')
  })

  it('rejects invalid or insecure external URLs', async () => {
    await expect(
      store.add({
        name: 'Insecure Link',
        type: 'custom',
        url: 'http://not-secure.com'
      })
    ).rejects.toThrow('External platform URLs must use HTTPS for security')

    await expect(
      store.add({
        name: 'Bad Protocol',
        type: 'custom',
        url: 'javascript:alert(1)'
      })
    ).rejects.toThrow('Only HTTP/HTTPS URLs are allowed')

    await expect(
      store.add({
        name: '',
        type: 'slack',
        url: 'https://app.slack.com'
      })
    ).rejects.toThrow('Platform name cannot be empty')
  })

  it('updates platform properties and auth status', async () => {
    const p = await store.add({
      name: 'Old Name',
      type: 'teams',
      url: 'https://teams.microsoft.com/v2/'
    })

    const updated = await store.update(p.id, {
      name: 'Client Teams (US)',
      icon: 'teams-custom'
    })
    expect(updated?.name).toBe('Client Teams (US)')
    expect(updated?.icon).toBe('teams-custom')

    await store.updateStatus(p.id, 'logged_in')
    const current = await store.get(p.id)
    expect(current?.authStatus).toBe('logged_in')
    expect(current?.lastCheckedAt).toBeDefined()
  })

  it('reorders and removes platforms', async () => {
    const p1 = await store.add({
      name: 'Slack 1',
      type: 'slack',
      url: 'https://app.slack.com/client/'
    })
    const p2 = await store.add({
      name: 'Teams 2',
      type: 'teams',
      url: 'https://teams.microsoft.com/v2/'
    })

    // Reorder: p2 before p1
    const reordered = await store.reorder([p2.id, p1.id])
    expect(reordered[0].id).toBe(p2.id)
    expect(reordered[1].id).toBe(p1.id)

    // Remove p1
    const removed = await store.remove(p1.id, false)
    expect(removed).toBe(true)

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(p2.id)
  })
})
