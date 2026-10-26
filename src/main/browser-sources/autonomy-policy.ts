import type { BrowserPlatformType } from './browser-source-types'

export type AutonomyMode = 'read_only' | 'ask_every_time' | 'full_access'

export type PolicyAction =
  | 'read'
  | 'navigate'
  | 'draft'
  | 'send'
  | 'search'
  | string

export type PolicyTrigger =
  | 'scheduled_sync'
  | 'evening_report'
  | 'agent_prompt'
  | 'user_manual'

export type PolicyDecision = 'allow' | 'needs_approval' | 'deny'

export interface PolicyContext {
  platformType?: BrowserPlatformType | string
  trigger?: PolicyTrigger | string
  projectId?: string
  platformId?: string
}

export interface ResolvedSettings {
  global?: AutonomyMode
  platform?: AutonomyMode
  project?: AutonomyMode
}

const WRITE_ACTIONS = new Set(['draft', 'send', 'write', 'delete', 'edit'])
const SEND_ACTIONS = new Set(['send'])

export function resolveSettings(settings: ResolvedSettings = {}): AutonomyMode {
  if (settings.project) return settings.project
  if (settings.platform) return settings.platform
  if (settings.global) return settings.global
  return 'read_only'
}

export function isWhatsAppHardBlocked(platformType: unknown, action: PolicyAction): boolean {
  const pt = String(platformType ?? '').toLowerCase()
  if (pt !== 'whatsapp') return false
  return WRITE_ACTIONS.has(String(action).toLowerCase())
}

export class AutonomyPolicyEngine {
  private globalMode: AutonomyMode = 'read_only'
  private platformModes = new Map<string, AutonomyMode>()
  private projectModes = new Map<string, AutonomyMode>()
  private fullAccessEnabled = false
  private fullAccessExpiresAt: number | null = null
  private now: () => number

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now())
  }

  setGlobalMode(mode: AutonomyMode): void {
    this.globalMode = mode
  }

  getGlobalMode(): AutonomyMode {
    return this.globalMode
  }

  setPlatformMode(platformId: string, mode: AutonomyMode): void {
    this.platformModes.set(platformId, mode)
  }

  setProjectMode(projectId: string, mode: AutonomyMode): void {
    this.projectModes.set(projectId, mode)
  }

  resolveMode(ctx: PolicyContext = {}): AutonomyMode {
    const project = ctx.projectId ? this.projectModes.get(ctx.projectId) : undefined
    const platform = ctx.platformId ? this.platformModes.get(ctx.platformId) : undefined
    return resolveSettings({ global: this.globalMode, platform, project })
  }

  enableFullAccess(token: string, durationMs?: number): boolean {
    if (token !== 'ENABLE') return false
    this.fullAccessEnabled = true
    this.fullAccessExpiresAt = typeof durationMs === 'number' ? this.now() + durationMs : null
    return true
  }

  disableFullAccess(): void {
    this.fullAccessEnabled = false
    this.fullAccessExpiresAt = null
  }

  isFullAccessActive(): boolean {
    if (!this.fullAccessEnabled) return false
    if (this.fullAccessExpiresAt !== null && this.now() > this.fullAccessExpiresAt) {
      this.disableFullAccess()
      return false
    }
    return true
  }

  evaluate(action: PolicyAction, ctx: PolicyContext = {}): PolicyDecision {
    const a = String(action).toLowerCase()
    const platformType = ctx.platformType

    // WhatsApp hard block: never allow writes.
    if (isWhatsAppHardBlocked(platformType, a)) return 'deny'

    // full_access auto-revert expiry.
    if (this.isFullAccessActive() === false && this.globalMode === 'full_access') {
      // fall through using resolved mode
    }

    const baseMode = this.resolveMode(ctx)
    let effectiveMode: AutonomyMode = baseMode
    if (baseMode === 'full_access' && !this.isFullAccessActive()) {
      effectiveMode = 'ask_every_time'
    }

    const trigger = ctx.trigger ?? 'user_manual'
    const isAgentPrompt = trigger === 'agent_prompt'

    // Read actions allowed in any mode.
    if (a === 'read' || a === 'navigate' || a === 'search' || a === 'list') {
      return 'allow'
    }

    const isWrite = WRITE_ACTIONS.has(a)
    const isSend = SEND_ACTIONS.has(a)

    if (!isWrite) {
      // Unknown actions default to needs_approval in non-read-only.
      if (effectiveMode === 'read_only') return 'deny'
      return 'needs_approval'
    }

    if (effectiveMode === 'read_only') return 'deny'

    if (effectiveMode === 'ask_every_time') {
      return 'needs_approval'
    }

    // full_access
    if (isSend) {
      if (isAgentPrompt) return 'needs_approval'
      return 'allow'
    }
    if (a === 'draft') {
      if (isAgentPrompt) return 'needs_approval'
      return 'allow'
    }
    return 'allow'
  }
}

// Back-compat aliases
export const BrowserSourcesPolicy = AutonomyPolicyEngine
export const PolicyEngine = AutonomyPolicyEngine
export const BrowserSourcePolicy = AutonomyPolicyEngine
export default AutonomyPolicyEngine
