import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DashboardMonitor,
  DashboardTeamWorkspace,
  DashboardTeamWorkspaceConnectPayload,
  DashboardTeamWorkspaceSource
} from '../../shared/dashboard-contract'

/** One team workspace is shared by every card (spec: ticket 04). */
export interface StoredTeamWorkspace {
  profileId: string
  teamId: string
  teamName: string
  source: 'oauth' | 'manual'
  /** safeStorage ciphertext (base64). Absent for an OAuth connection. */
  tokenEnc?: string
  /** Fallback when the OS has no encryption. Absent for an OAuth connection. */
  tokenPlain?: string
  /** Mask shown in the UI ("••••abcd") — never the raw token. */
  maskedToken: string | null
  channels: DashboardMonitor[]
  updatedAt: string
}

export interface TeamWorkspaceConnection {
  profileId: string
  teamId: string
  teamName: string
  source: 'oauth' | 'manual'
  /** Raw token for a manual connection; null when the token lives in TokenStore. */
  token: string | null
  channels: DashboardMonitor[]
}

interface TeamWorkspaceFile {
  workspace?: StoredTeamWorkspace
}

interface EncryptedVault {
  encrypt(plain: string): string
  decrypt(b64: string): string
}

let vault: EncryptedVault | null = null

async function getVault(): Promise<EncryptedVault> {
  if (!vault) {
    const { safeStorage } = (await import('electron')) as typeof import('electron')
    vault = {
      encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
      decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64'))
    }
  }
  return vault
}

/** A token never leaves the process, so the UI only ever gets this shape. */
export function maskToken(token: string | null): string | null {
  if (!token) return null
  return token.length <= 8 ? '••••' : `••••${token.slice(-4)}`
}

const UNCONNECTED: DashboardTeamWorkspace = {
  connected: false,
  profileId: null,
  teamId: null,
  teamName: null,
  source: 'none',
  maskedToken: null,
  channels: [],
  updatedAt: null
}

/**
 * The globally connected "our team" Slack workspace: connection facts plus the
 * pinned channel set. The secret is encrypted with safeStorage; with no OS
 * encryption available it falls back to plaintext, exactly like MonitorStore.
 */
export class TeamWorkspaceStore {
  private readonly filePath: string
  private readonly encryptionAvailable: boolean
  private readonly vault: EncryptedVault | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(options: {
    rootDir: string
    encryptionAvailable: boolean
    /** Test seam: production leaves this out and uses Electron safeStorage. */
    vault?: EncryptedVault
  }) {
    this.filePath = join(options.rootDir, 'team-workspace.json')
    this.encryptionAvailable = options.encryptionAvailable
    this.vault = options.vault
  }

  /** Mask-only view for the renderer. */
  async readPublic(): Promise<DashboardTeamWorkspace> {
    const ws = (await this.read()).workspace
    if (!ws) return UNCONNECTED
    return {
      connected: true,
      profileId: ws.profileId,
      teamId: ws.teamId,
      teamName: ws.teamName,
      source: ws.source as DashboardTeamWorkspaceSource,
      maskedToken: ws.maskedToken,
      channels: ws.channels,
      updatedAt: ws.updatedAt
    }
  }

  /** What sync/chat needs: where the workspace is and the channels pinned to it. */
  async getConnection(): Promise<TeamWorkspaceConnection | null> {
    const ws = (await this.read()).workspace
    if (!ws) return null
    return {
      profileId: ws.profileId,
      teamId: ws.teamId,
      teamName: ws.teamName,
      source: ws.source,
      token: await this.readToken(ws),
      channels: ws.channels
    }
  }

  /** Connect (or reconnect — the old record is replaced, never accumulated). */
  async connect(input: {
    payload: DashboardTeamWorkspaceConnectPayload
    teamId: string
    teamName: string
    profileId: string
    /** For an OAuth connection the token itself stays in TokenStore; only its mask is stored. */
    token?: string
    maskedToken?: string | null
    channels?: DashboardMonitor[]
    now?: string
  }): Promise<DashboardTeamWorkspace> {
    const encrypted = input.token ? await this.encrypt(input.token) : null
    const record: StoredTeamWorkspace = {
      profileId: input.profileId,
      teamId: input.teamId,
      teamName: input.teamName,
      source: input.payload.source,
      ...(encrypted?.enc ? { tokenEnc: encrypted.enc } : {}),
      ...(encrypted?.plain ? { tokenPlain: encrypted.plain } : {}),
      maskedToken: input.maskedToken ?? maskToken(input.token ?? null),
      channels: input.channels ?? [],
      updatedAt: input.now ?? new Date().toISOString()
    }
    await this.mutate(() => ({ workspace: record }))
    return this.readPublic()
  }

  /** Re-pin without reconnecting. Never touches the secret. */
  async setChannels(channels: DashboardMonitor[]): Promise<DashboardTeamWorkspace> {
    let found = false
    await this.mutate((current) => {
      if (!current.workspace) return current
      found = true
      return {
        workspace: {
          ...current.workspace,
          channels,
          updatedAt: new Date().toISOString()
        }
      }
    })
    if (!found) throw new Error('No team workspace is connected yet.')
    return this.readPublic()
  }

  /** Disconnect: removes the record and its secret with it. */
  async clear(): Promise<void> {
    await this.mutate(() => ({}))
  }

  private async readToken(ws: StoredTeamWorkspace): Promise<string | null> {
    if (!this.encryptionAvailable) return ws.tokenPlain ?? null
    if (!ws.tokenEnc) return ws.tokenPlain ?? null
    try {
      return (await this.activeVault()).decrypt(ws.tokenEnc.replace(/[\r\n]/g, ''))
    } catch {
      return ws.tokenPlain ?? null
    }
  }

  private async encrypt(token: string): Promise<{ enc?: string; plain?: string }> {
    if (!this.encryptionAvailable) return { plain: token }
    return { enc: (await this.activeVault()).encrypt(token) }
  }

  private async activeVault(): Promise<EncryptedVault> {
    return this.vault ?? getVault()
  }

  private async mutate(fn: (current: TeamWorkspaceFile) => TeamWorkspaceFile): Promise<void> {
    const run = async (): Promise<void> => {
      const next = fn(await this.read())
      await mkdir(join(this.filePath, '..'), { recursive: true })
      const tmpPath = `${this.filePath}.tmp`
      await writeFile(tmpPath, JSON.stringify(next, null, 2), 'utf8')
      await rename(tmpPath, this.filePath)
    }
    this.queue = this.queue.then(run, run)
    return this.queue
  }

  private async read(): Promise<TeamWorkspaceFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as TeamWorkspaceFile
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
}
