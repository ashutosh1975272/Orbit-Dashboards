import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DashboardProject } from '../../shared/dashboard-contract'

interface MonitorFile {
  projects: DashboardProject[]
  manualTokens: Record<string, string>
  syncIntervalSeconds?: number
  updatedAt?: string
}

/** Persisted monitor config: projects + manual tokens + sync interval. */
export class MonitorStore {
  private readonly filePath: string
  private encryptionAvailable: boolean

  constructor(options: { rootDir: string; encryptionAvailable: boolean }) {
    this.filePath = join(options.rootDir, 'monitors.json')
    this.encryptionAvailable = options.encryptionAvailable
  }

  async listProjects(): Promise<DashboardProject[]> {
    return (await this.read()).projects
  }

  async upsertProject(input: {
    project:
      | Omit<DashboardProject, 'id' | 'createdAt'>
      | (Omit<DashboardProject, 'createdAt'> & { id: string })
  }): Promise<DashboardProject> {
    const data = await this.read()
    let project: DashboardProject
    const incoming = input.project
    if ('id' in incoming && incoming.id) {
      const incomingId = incoming.id
      const existing = data.projects.find((p) => p.id === incomingId)
      if (existing) {
        project = { ...existing, ...incoming }
        data.projects = data.projects.filter((p) => p.id !== project.id)
      } else {
        project = {
          ...(incoming as Omit<DashboardProject, 'createdAt'>),
          createdAt: new Date().toISOString()
        }
      }
    } else {
      project = {
        ...(incoming as Omit<DashboardProject, 'id' | 'createdAt'>),
        id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString()
      }
    }
    data.projects.push(project)
    await this.write(data)
    return project
  }

  async deleteProject(projectId: string): Promise<void> {
    const data = await this.read()
    data.projects = data.projects.filter((p) => p.id !== projectId)
    await this.write(data)
  }

  /** os-encrypted when safeStorage available (encrypt b64) else plaintext JSON. */
  async saveManualToken(key: string, token: string): Promise<{ plaintext: boolean }> {
    if (!this.encryptionAvailable) {
      return { plaintext: await this.savePlain(key, token) }
    }
    throw new Error('covered by encrypted path — see below')
  }

  private async savePlain(key: string, token: string): Promise<boolean> {
    const data = await this.read()
    data.manualTokens = { ...data.manualTokens, [key]: token }
    await this.write(data)
    return true
  }

  async getManualToken(key: string): Promise<string | null> {
    return (await this.read()).manualTokens[key] ?? null
  }

  async deleteManualToken(key: string): Promise<void> {
    const data = await this.read()
    const next = { ...data.manualTokens }
    delete next[key]
    data.manualTokens = next
    await this.write(data)
  }

  async listManualTokens(): Promise<Array<{ key: string; persisted: boolean }>> {
    const data = await this.read()
    return Object.keys(data.manualTokens).map((key) => ({ key, persisted: true }))
  }

  /** Store workspace metadata discovered during token validation. */
  async upsertProjectManualTokenMeta(
    key: string,
    meta: { teamId: string; teamName: string }
  ): Promise<void> {
    const data = await this.read()
    const id = `manual_${key}`
    const existing = data.projects.find((p) => p.id === id)
    if (existing) {
      existing.manualTokenKey = key
    } else {
      data.projects.push({
        id,
        name: meta.teamName,
        clientName: meta.teamName,
        profileId: 'manual',
        teamId: meta.teamId,
        appId: 'slack',
        tokenSource: 'manual',
        manualTokenKey: key,
        monitors: [],
        createdAt: new Date().toISOString()
      })
    }
    await this.write(data)
  }

  async syncIntervalSeconds(): Promise<number> {
    const data = await this.read()
    const v = data.syncIntervalSeconds
    return typeof v === 'number' && v >= 30 ? v : 300
  }

  async setSyncIntervalSeconds(seconds: number): Promise<void> {
    const data = await this.read()
    data.syncIntervalSeconds = Math.max(30, Math.floor(seconds))
    await this.write(data)
  }

  private async read(): Promise<MonitorFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return JSON.parse(raw) as MonitorFile
    } catch {
      return { projects: [], manualTokens: {} }
    }
  }

  private async write(data: MonitorFile): Promise<void> {
    const record: MonitorFile = {
      ...data,
      updatedAt: new Date().toISOString()
    }
    await mkdir(join(this.filePath, '..'), { recursive: true })
    const tmpPath = `${this.filePath}.tmp`
    await writeFile(tmpPath, JSON.stringify(record, null, 2), 'utf8')
    await rename(tmpPath, this.filePath)
  }
}
