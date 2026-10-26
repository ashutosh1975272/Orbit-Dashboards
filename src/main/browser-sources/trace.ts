import { mkdir, readFile, writeFile, appendFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface TraceEvent {
  runId: string
  projectId: string
  platform: string
  trigger: string
  ts: string
  type: string
  duration?: number
  details?: Record<string, unknown>
}

const SECRET_PATTERNS: RegExp[] = [
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ghp_[A-Za-z0-9]+/g,
  /sk-[A-Za-z0-9]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi
]

export function redactSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    let out = value
    for (const p of SECRET_PATTERNS) {
      out = out.replace(p, '[REDACTED]')
    }
    return out
  }
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSecrets(v)
    }
    return out
  }
  return value
}

export function traceFilePath(rootDir: string, projectId: string): string {
  return join(rootDir, 'browser-trace', `${projectId}.jsonl`)
}

export class RunTraceStore {
  readonly rootDir: string
  private readonly retentionDays: number

  constructor(options: { rootDir: string; retentionDays?: number }) {
    this.rootDir = options.rootDir
    this.retentionDays = options.retentionDays ?? 30
  }

  private async ensureDir(): Promise<void> {
    await mkdir(join(this.rootDir, 'browser-trace'), { recursive: true })
  }

  async append(projectId: string, event: TraceEvent): Promise<void> {
    await this.ensureDir()
    const redacted = redactSecrets(event) as TraceEvent
    const line = JSON.stringify(redacted) + '\n'
    await appendFile(traceFilePath(this.rootDir, projectId), line, 'utf8')
  }

  async read(projectId: string): Promise<TraceEvent[]> {
    try {
      const raw = await readFile(traceFilePath(this.rootDir, projectId), 'utf8')
      return raw
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l) as TraceEvent
          } catch {
            return null
          }
        })
        .filter((e): e is TraceEvent => e !== null)
    } catch {
      return []
    }
  }

  async clear(projectId: string): Promise<void> {
    try {
      await writeFile(traceFilePath(this.rootDir, projectId), '', 'utf8')
    } catch {
      // ignore
    }
  }

  async enforceRetention(projectId: string): Promise<void> {
    const events = await this.read(projectId)
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
    const kept = events.filter((e) => Date.parse(e.ts) >= cutoff || Number.isNaN(Date.parse(e.ts)))
    const content = kept.map((e) => JSON.stringify(e) + '\n').join('')
    await this.ensureDir()
    await writeFile(traceFilePath(this.rootDir, projectId), content, 'utf8')
  }

  async exportJson(projectId: string): Promise<string> {
    const events = await this.read(projectId)
    return JSON.stringify(events, null, 2)
  }

  async exportCsv(projectId: string): Promise<string> {
    const events = await this.read(projectId)
    const header = 'runId,projectId,platform,trigger,ts,type,duration'
    const rows = events.map((e) =>
      [e.runId, e.projectId, e.platform, e.trigger, e.ts, e.type, e.duration ?? ''].join(',')
    )
    return [header, ...rows].join('\n')
  }

  async listProjects(): Promise<string[]> {
    try {
      const dir = join(this.rootDir, 'browser-trace')
      const files = await readdir(dir)
      return files.filter((f) => f.endsWith('.jsonl')).map((f) => f.replace(/\.jsonl$/, ''))
    } catch {
      return []
    }
  }
}

export const BrowserTraceStore = RunTraceStore
export const BrowserSourcesTrace = RunTraceStore
export default RunTraceStore
