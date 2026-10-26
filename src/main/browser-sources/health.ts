import type { BrowserSourceAuthStatus } from './browser-source-types'

export interface PlatformHealth {
  platformId: string
  status: BrowserSourceAuthStatus
  lastCheckedAt?: string
  message?: string
}

export class HealthMonitor {
  private health = new Map<string, PlatformHealth>()
  update(h: PlatformHealth): void { this.health.set(h.platformId, h) }
  get(platformId: string): PlatformHealth | undefined { return this.health.get(platformId) }
  list(): PlatformHealth[] { return [...this.health.values()] }
  connectedCount(): number { return [...this.health.values()].filter(h => h.status === 'logged_in').length }
}
