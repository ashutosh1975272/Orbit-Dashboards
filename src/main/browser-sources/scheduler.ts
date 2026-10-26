
export type BrowserSyncInterval = 5 | 15 | 30 | 60 | 0

export interface BrowserSchedulerDeps {
  now?: () => number
  random?: () => number
  onTick?: (platformId: string) => Promise<void> | void
  isWithinWorkingHours?: (now: number) => boolean
}

export interface BrowserSchedulerConfig {
  intervalMinutes: BrowserSyncInterval
  jitterPct: number
  workingHoursStart: number // hour 0-23
  workingHoursEnd: number
  paused: boolean
}

const DEFAULT_CONFIG: BrowserSchedulerConfig = {
  intervalMinutes: 15,
  jitterPct: 0.2,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  paused: false
}

export function applyJitter(baseMs: number, pct = 0.2, random = Math.random): number {
  const delta = baseMs * pct
  const offset = (random() * 2 - 1) * delta
  return Math.max(0, Math.round(baseMs + offset))
}

export function isWithinWorkingHours(
  now: number,
  startHour = 9,
  endHour = 18
): boolean {
  const d = new Date(now)
  const h = d.getHours() + d.getMinutes() / 60
  if (startHour <= endHour) return h >= startHour && h < endHour
  return h >= startHour || h < endHour
}

export function computeNextRun(now: number, intervalMinutes: number, jitterPct = 0.2, random = Math.random): number {
  const base = intervalMinutes * 60_000
  return now + applyJitter(base, jitterPct, random)
}

export class BrowserSourcesScheduler {
  private config: BrowserSchedulerConfig = { ...DEFAULT_CONFIG }
  private readonly deps: BrowserSchedulerDeps
  private readonly now: () => number
  private readonly random: () => number
  private timer: ReturnType<typeof setTimeout> | null = null
  private paused = false

  constructor(deps: BrowserSchedulerDeps = {}) {
    this.deps = deps
    this.now = deps.now ?? (() => Date.now())
    this.random = deps.random ?? Math.random
  }

  getConfig(): BrowserSchedulerConfig {
    return { ...this.config }
  }

  setIntervalMinutes(minutes: BrowserSyncInterval): void {
    this.config.intervalMinutes = minutes
  }

  setJitterPct(pct: number): void {
    this.config.jitterPct = pct
  }

  setWorkingHours(start: number, end: number): void {
    this.config.workingHoursStart = start
    this.config.workingHoursEnd = end
  }

  pause(): void {
    this.paused = true
    this.clearTimer()
  }

  resume(): void {
    this.paused = false
  }

  isPaused(): boolean {
    return this.paused
  }

  clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private inWorkingHours(): boolean {
    if (this.deps.isWithinWorkingHours) return this.deps.isWithinWorkingHours(this.now())
    return isWithinWorkingHours(this.now(), this.config.workingHoursStart, this.config.workingHoursEnd)
  }

  async tick(platformIds: string[]): Promise<{ navigated: string[]; skipped: string[] }> {
    const navigated: string[] = []
    const skipped: string[] = []
    if (this.paused) return { navigated, skipped }
    if (this.config.intervalMinutes === 0) return { navigated, skipped }
    if (!this.inWorkingHours()) return { navigated, skipped }

    for (const id of platformIds) {
      // Smart sync: only navigate platforms with unread (caller decides); here we just invoke onTick.
      try {
        await this.deps.onTick?.(id)
        navigated.push(id)
      } catch {
        skipped.push(id)
      }
    }
    return { navigated, skipped }
  }

  scheduleNext(platformIds: string[], onFire?: () => void): void {
    if (this.paused || this.config.intervalMinutes === 0) return
    this.clearTimer()
    const actualDelay = applyJitter(this.config.intervalMinutes * 60_000, this.config.jitterPct, this.random)
    this.timer = setTimeout(async () => {
      if (!this.paused) {
        await this.tick(platformIds)
        onFire?.()
        this.scheduleNext(platformIds, onFire)
      }
    }, actualDelay)
  }

  stop(): void {
    this.clearTimer()
    this.paused = true
  }
}

export const BrowserScheduler = BrowserSourcesScheduler
export default BrowserSourcesScheduler
