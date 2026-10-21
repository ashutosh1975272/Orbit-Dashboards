import type { DashboardSyncEngine } from './sync-engine'

/**
 * Background scheduler for the dashboard sync engine (ADR-0007).
 * Interval comes from the persisted monitor config (default 300s).
 * addEventListener on window (renderer) is not applicable here —
 * we use setInterval in the main process. Timer is unref-safe.
 */
export class DashboardScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private readonly engine: DashboardSyncEngine
  private readonly getIntervalSeconds: () => Promise<number>

  constructor(engine: DashboardSyncEngine, getIntervalSeconds: () => Promise<number>) {
    this.engine = engine
    this.getIntervalSeconds = getIntervalSeconds
  }

  start(): void {
    if (this.timer) return
    void (async () => {
      const seconds = Math.max(15, await this.getIntervalSeconds())
      const runAndReschedule = async (): Promise<void> => {
        await this.tick()
        this.timer = setTimeout(runAndReschedule as unknown as () => void, seconds * 1000)
      }
      this.timer = setTimeout(runAndReschedule as unknown as () => void, seconds * 1000)
    })()
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.running = false
  }

  private async tick(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      await this.engine.syncAll()
    } finally {
      this.running = false
    }
  }

  async triggerNow(): Promise<void> {
    await this.engine.syncAll()
  }
}
