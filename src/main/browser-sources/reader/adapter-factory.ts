import type { BrowserPlatformType } from '../browser-source-types'
import type { PlatformReaderAdapter } from './adapter-interface'
import { SlackBrowserAdapter } from './slack-adapter'
import { TeamsBrowserAdapter } from './teams-adapter'
import { WhatsAppBrowserAdapter } from './whatsapp-adapter'
import { CustomBrowserAdapter } from './custom-adapter'

export function createAdapter(type: BrowserPlatformType): PlatformReaderAdapter {
  switch (type) {
    case 'slack': return new SlackBrowserAdapter()
    case 'teams': return new TeamsBrowserAdapter()
    case 'whatsapp': return new WhatsAppBrowserAdapter()
    case 'discord':
    case 'upwork':
    case 'custom':
    default: return new CustomBrowserAdapter()
  }
}
