import { log } from '../../logging'
import type { WebContentsView } from 'electron'
import type { DashboardStoredMessage } from '../../dashboard/delta-store'
import type { PlatformReaderAdapter, ScrapedChannelInfo } from './adapter-interface'
import { deduplicateMessages, normalizeScrapedMessage } from './normalizer'

export class CustomBrowserAdapter implements PlatformReaderAdapter {
  readonly platformType = 'custom' as const

  async detectLoggedIn(view: WebContentsView): Promise<boolean> {
    try {
      const url = view.webContents.getURL()
      return !!url && url !== 'about:blank'
    } catch { return false }
  }

  async listUnreadChannels(_view: WebContentsView): Promise<ScrapedChannelInfo[]> {
    return []
  }

  async readVisibleMessages(view: WebContentsView, channelId: string): Promise<DashboardStoredMessage[]> {
    try {
      const raw = await view.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('article, .message, [role="article"]')).map(e => ({ rawTs: String(Date.now()/1000), sender: '', text: (e.innerText||e.textContent||'').trim() })).filter(x=>x.text)`,
        true
      ) as Array<{rawTs:string;sender:string;text:string}>
      const normalized = (raw ?? []).map(r => normalizeScrapedMessage(r, channelId, 'custom'))
      return deduplicateMessages(normalized, channelId)
    } catch (err) {
      log.warn('custom adapter: readVisibleMessages failed', { err: String(err) })
      return []
    }
  }
}
