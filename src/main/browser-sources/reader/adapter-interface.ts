import type { WebContentsView } from 'electron'
import type { DashboardStoredMessage } from '../../dashboard/delta-store'
import type { BrowserPlatformType } from '../browser-source-types'

export interface ScrapedChannelInfo {
  id: string
  name: string
  hasUnread: boolean
  unreadCount?: number
}

export interface PlatformReaderAdapter {
  platformType: BrowserPlatformType
  detectLoggedIn(view: WebContentsView): Promise<boolean>
  listUnreadChannels(view: WebContentsView): Promise<ScrapedChannelInfo[]>
  readVisibleMessages(view: WebContentsView, channelId: string): Promise<DashboardStoredMessage[]>
}

