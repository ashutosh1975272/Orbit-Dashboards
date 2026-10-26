export type BrowserPlatformType =
  | 'slack'
  | 'teams'
  | 'whatsapp'
  | 'discord'
  | 'upwork'
  | 'custom'

export type BrowserSourceAuthStatus = 'logged_in' | 'needs_login' | 'adapter_broken' | 'paused'

export interface BrowserPlatformConfig {
  id: string
  name: string
  type: BrowserPlatformType
  url: string
  icon?: string
  partition: string
  authStatus: BrowserSourceAuthStatus
  lastCheckedAt?: string
  errorMessage?: string
  createdAt: string
  custom?: boolean
  order?: number
}

export interface BrowserSourceStatusEvent {
  platformId: string
  authStatus: BrowserSourceAuthStatus
  lastCheckedAt: string
  errorMessage?: string
}

export interface BrowserSourceViewportBounds {
  x: number
  y: number
  width: number
  height: number
}
