import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../logging'

export interface RunLogEntry {
  runId: string
  ts: string
  trigger: 'scheduled' | 'manual'
  projectId: string
  sourceId: string
  sourceKind: 'token' | 'browser'
  workspaceId: string
  channelsRead: number
  newMessages: number
  skippedReason?: string
  durationMs: number
  llmCalls: number
  status: 'connected' | 'needs-login' | 'challenge' | 'adapter-broken' | 'paused' | 'running'
  errorCode?: string
}

export class RunLogStore {
  private readonly dirPath: string

  constructor(options: { rootDir: string }) {
    this.dirPath = join(options.rootDir, 'run-logs')
  }

  private logFilePath(projectId: string): string {
    return join(this.dirPath, `${projectId}.jsonl`)
  }

  async append(entry: RunLogEntry): Promise<void> {
    try {
      await mkdir(this.dirPath, { recursive: true })
      const line = JSON.stringify(entry) + '\n'
      await appendFile(this.logFilePath(entry.projectId), line, 'utf-8')
    } catch (err) {
      log.warn('failed to append run log entry', { err: String(err) })
    }
  }

  async read(projectId: string, limit = 50): Promise<RunLogEntry[]> {
    try {
      const content = await readFile(this.logFilePath(projectId), 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const entries: RunLogEntry[] = []
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line) as RunLogEntry)
        } catch {
          // ignore corrupted line
        }
      }
      return entries.reverse().slice(0, limit)
    } catch {
      return []
    }
  }
}
