import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { session as electronSession } from 'electron'
import { log } from '../logging'
import type {
  AddBrowserPlatformInput,
  BrowserPlatformConfig,
  BrowserPlatformType,
  BrowserSourceAuthStatus
} from './browser-source-types'
import { partitionForBrowserSource } from './session-partition'

export const BROWSER_PLATFORM_PRESETS: Record<
  Exclude<BrowserPlatformType, 'custom'>,
  { name: string; url: string; icon: string }
> = {
  slack: {
    name: 'Slack Web',
    url: 'https://app.slack.com/client/',
    icon: 'slack'
  },
  teams: {
    name: 'Microsoft Teams',
    url: 'https://teams.microsoft.com/v2/',
    icon: 'teams'
  },
  whatsapp: {
    name: 'WhatsApp Web',
    url: 'https://web.whatsapp.com/',
    icon: 'whatsapp'
  },
  discord: {
    name: 'Discord Web',
    url: 'https://discord.com/app',
    icon: 'discord'
  },
  upwork: {
    name: 'Upwork Messages',
    url: 'https://www.upwork.com/messages/',
    icon: 'upwork'
  }
}

export interface StoredBrowserPlatforms {
  version: 1
  platforms: BrowserPlatformConfig[]
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new Error('Platform URL cannot be empty')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP/HTTPS URLs are allowed')
  }

  // Require HTTPS unless localhost
  if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('External platform URLs must use HTTPS for security')
  }

  return parsed.toString()
}

export class BrowserPlatformStore {
  private readonly filePath: string
  private queue: Promise<void> = Promise.resolve()

  constructor(options: { rootDir: string }) {
    this.filePath = join(options.rootDir, 'browser-platforms.json')
  }

  async list(): Promise<BrowserPlatformConfig[]> {
    const data = await this.readData()
    return [...data.platforms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  async get(id: string): Promise<BrowserPlatformConfig | null> {
    const platforms = await this.list()
    return platforms.find((p) => p.id === id) ?? null
  }

  async add(input: AddBrowserPlatformInput): Promise<BrowserPlatformConfig> {
    const url = normalizeUrl(input.url)
    const name = input.name.trim()
    if (!name) {
      throw new Error('Platform name cannot be empty')
    }

    const id = `${input.type}-${randomUUID().slice(0, 8)}`
    const partition = partitionForBrowserSource(id)

    const newPlatform: BrowserPlatformConfig = {
      id,
      name,
      type: input.type,
      url,
      icon: input.icon ?? input.type,
      partition,
      authStatus: 'needs_login',
      createdAt: new Date().toISOString(),
      custom: input.type === 'custom'
    }

    await this.mutate((current) => {
      newPlatform.order = current.platforms.length
      return {
        ...current,
        platforms: [...current.platforms, newPlatform]
      }
    })

    log.info('browser platform added', { id, name, type: input.type, url })
    return newPlatform
  }

  async update(
    id: string,
    patch: Partial<Pick<BrowserPlatformConfig, 'name' | 'url' | 'icon' | 'order'>>
  ): Promise<BrowserPlatformConfig | null> {
    let updated: BrowserPlatformConfig | null = null

    await this.mutate((current) => {
      const idx = current.platforms.findIndex((p) => p.id === id)
      if (idx === -1) return current

      const existing = current.platforms[idx]
      const nextUrl = patch.url ? normalizeUrl(patch.url) : existing.url
      const nextName = patch.name ? patch.name.trim() : existing.name

      updated = {
        ...existing,
        name: nextName || existing.name,
        url: nextUrl,
        icon: patch.icon ?? existing.icon,
        order: patch.order ?? existing.order
      }

      const copy = [...current.platforms]
      copy[idx] = updated
      return {
        ...current,
        platforms: copy
      }
    })

    return updated
  }

  async updateStatus(
    id: string,
    authStatus: BrowserSourceAuthStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.mutate((current) => {
      const idx = current.platforms.findIndex((p) => p.id === id)
      if (idx === -1) return current

      const existing = current.platforms[idx]
      const copy = [...current.platforms]
      copy[idx] = {
        ...existing,
        authStatus,
        lastCheckedAt: new Date().toISOString(),
        errorMessage: errorMessage ?? existing.errorMessage
      }
      return {
        ...current,
        platforms: copy
      }
    })
  }

  async remove(id: string, clearSession = true): Promise<boolean> {
    let removed = false
    let partitionToClear: string | null = null

    await this.mutate((current) => {
      const target = current.platforms.find((p) => p.id === id)
      if (!target) return current

      removed = true
      partitionToClear = target.partition
      return {
        ...current,
        platforms: current.platforms.filter((p) => p.id !== id)
      }
    })

    if (removed && clearSession && partitionToClear) {
      this.clearPartitionStorage(partitionToClear)
    }

    log.info('browser platform removed', { id, removed, clearSession })
    return removed
  }

  async reorder(orderedIds: string[]): Promise<BrowserPlatformConfig[]> {
    let result: BrowserPlatformConfig[] = []
    await this.mutate((current) => {
      const map = new Map(current.platforms.map((p) => [p.id, p]))
      const next: BrowserPlatformConfig[] = []

      orderedIds.forEach((id, index) => {
        const item = map.get(id)
        if (item) {
          next.push({ ...item, order: index })
          map.delete(id)
        }
      })

      // Append remaining items that weren't in orderedIds
      for (const remaining of map.values()) {
        next.push({ ...remaining, order: next.length })
      }

      result = next
      return {
        ...current,
        platforms: next
      }
    })

    return result
  }

  private clearPartitionStorage(partition: string): void {
    try {
      if (typeof electronSession?.fromPartition === 'function') {
        const ses = electronSession.fromPartition(partition)
        void ses.clearStorageData()
        log.info('cleared session storage for partition', { partition })
      }
    } catch (err) {
      log.warn('failed to clear storage data for partition', { partition, err: String(err) })
    }
  }

  private async readData(): Promise<StoredBrowserPlatforms> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<StoredBrowserPlatforms>
      if (Array.isArray(parsed?.platforms)) {
        return {
          version: 1,
          platforms: parsed.platforms
        }
      }
    } catch {
      /* fallback on missing or malformed file */
    }
    return { version: 1, platforms: [] }
  }

  private async mutate(
    fn: (current: StoredBrowserPlatforms) => StoredBrowserPlatforms
  ): Promise<void> {
    const op = async (): Promise<void> => {
      const current = await this.readData()
      const next = fn(current)
      await mkdir(join(this.filePath, '..'), { recursive: true })
      const tmp = `${this.filePath}.tmp`
      await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
      await rename(tmp, this.filePath)
    }

    this.queue = this.queue.then(op, op)
    await this.queue
  }
}

