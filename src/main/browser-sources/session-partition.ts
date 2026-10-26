import { session as electronSession, type Session, type WebPreferences } from 'electron'
import { CHROME_USER_AGENT } from '../profiles/session-partition'
import type { BrowserPlatformType } from './browser-source-types'

export function partitionForBrowserSource(platformId: string): string {
  const clean = platformId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return `persist:bs-${clean}`
}

export function safeHostname(urlString: string): string {
  try {
    return new URL(urlString).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const COMMON_SSO_DOMAINS = [
  'accounts.google.com',
  'google.com',
  'googleusercontent.com',
  'login.microsoftonline.com',
  'login.live.com',
  'account.live.com',
  'login.microsoft.com',
  'microsoftonline.com',
  'microsoft.com',
  'msauth.net',
  'msftauth.net',
  'okta.com',
  'oktapreview.com',
  'auth0.com',
  'onelogin.com',
  'pingidentity.com',
  'duosecurity.com'
]

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function isAllowedEmbedDomain(
  urlString: string,
  platformType: BrowserPlatformType,
  customBaseUrl?: string
): boolean {
  const host = safeHostname(urlString)
  if (!host) return false

  // Allow common corporate SSO redirects across all platform types
  for (const sso of COMMON_SSO_DOMAINS) {
    if (matchesDomain(host, sso)) return true
  }

  if (platformType === 'slack') {
    return (
      matchesDomain(host, 'slack.com') ||
      matchesDomain(host, 'slack-edge.com') ||
      matchesDomain(host, 'slack-msgs.com') ||
      matchesDomain(host, 'slack-files.com')
    )
  }

  if (platformType === 'teams') {
    return (
      matchesDomain(host, 'teams.microsoft.com') ||
      matchesDomain(host, 'teams.live.com') ||
      matchesDomain(host, 'office.com') ||
      matchesDomain(host, 'office365.com') ||
      matchesDomain(host, 'sharepoint.com')
    )
  }

  if (platformType === 'whatsapp') {
    return (
      matchesDomain(host, 'whatsapp.com') ||
      matchesDomain(host, 'web.whatsapp.com') ||
      matchesDomain(host, 'wa.me') ||
      matchesDomain(host, 'facebook.com')
    )
  }

  if (platformType === 'discord') {
    return (
      matchesDomain(host, 'discord.com') ||
      matchesDomain(host, 'discordapp.com') ||
      matchesDomain(host, 'discord.gg')
    )
  }

  if (platformType === 'upwork') {
    return (
      matchesDomain(host, 'upwork.com') ||
      matchesDomain(host, 'www.upwork.com')
    )
  }

  if (platformType === 'custom' && customBaseUrl) {
    const baseHost = safeHostname(customBaseUrl)
    if (baseHost && matchesDomain(host, baseHost)) {
      return true
    }
  }

  return false
}

export function applyBrowserSourceSessionTweaks(partition: string): Session | null {
  if (typeof electronSession?.fromPartition !== 'function') {
    return null
  }
  const ses = electronSession.fromPartition(partition)
  ses.setUserAgent(CHROME_USER_AGENT)
  return ses
}

export function browserSourceSessionWebPreferences(
  platformId: string,
  preloadPath?: string
): Pick<WebPreferences, 'partition' | 'sandbox' | 'contextIsolation' | 'nodeIntegration' | 'preload'> {
  const partition = partitionForBrowserSource(platformId)
  applyBrowserSourceSessionTweaks(partition)
  const prefs: Pick<
    WebPreferences,
    'partition' | 'sandbox' | 'contextIsolation' | 'nodeIntegration' | 'preload'
  > = {
    partition,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false
  }
  if (preloadPath) {
    prefs.preload = preloadPath
  }
  return prefs
}
