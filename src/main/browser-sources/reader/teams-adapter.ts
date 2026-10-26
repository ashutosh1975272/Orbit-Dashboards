import { log } from '../../logging'
import type { WebContentsView } from 'electron'
import type { DashboardStoredMessage } from '../../dashboard/delta-store'
import type { PlatformReaderAdapter, ScrapedChannelInfo } from './adapter-interface'
import { deduplicateMessages, normalizeScrapedMessage } from './normalizer'

export const TEAMS_READ_CHANNELS_SCRIPT = `
(function() {
  const results = [];
  const items = document.querySelectorAll('[data-tid="channel-list-item"], .channel-list-item');
  items.forEach(item => {
    const badge = item.querySelector('[data-tid="channel-unread-badge"], .unread-badge');
    const nameEl = item.querySelector('[data-tid="channel-name"]');
    if (nameEl) {
      results.push({ id: nameEl.textContent?.trim() || '', name: nameEl.textContent?.trim() || '', hasUnread: !!badge });
    }
  });
  return results;
})()
`

export const TEAMS_READ_MESSAGES_SCRIPT = `
(function() {
  const results = [];
  const rows = document.querySelectorAll('[data-tid="chat-message"], [role="listitem"]');
  rows.forEach(row => {
    const senderEl = row.querySelector('[data-tid="message-author-name"]');
    const tsEl = row.querySelector('[data-tid="message-timestamp"]');
    const bodyEl = row.querySelector('[data-tid="message-body"]');
    const ts = tsEl?.textContent?.trim() || '';
    const text = bodyEl?.innerText?.trim() || bodyEl?.textContent?.trim() || '';
    const sender = senderEl?.textContent?.trim() || '';
    if (text) results.push({ rawTs: ts || String(Date.now()/1000), sender, text });
  });
  return results;
})()
`

export class TeamsBrowserAdapter implements PlatformReaderAdapter {
  readonly platformType = 'teams' as const

  async detectLoggedIn(view: WebContentsView): Promise<boolean> {
    try {
      const url = view.webContents.getURL()
      if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) {
        const r = await view.webContents.executeJavaScript(
          `Boolean(document.querySelector('[data-tid="app-layout"], #teams-app, .app-container'))`, true)
        return Boolean(r)
      }
      return false
    } catch { return false }
  }

  async listUnreadChannels(view: WebContentsView): Promise<ScrapedChannelInfo[]> {
    try {
      const raw = await view.webContents.executeJavaScript(TEAMS_READ_CHANNELS_SCRIPT, true) as Array<{id:string;name:string;hasUnread:boolean}>
      return (raw ?? []).filter(c => c.hasUnread && c.id)
    } catch (err) {
      log.warn('teams adapter: listUnreadChannels failed', { err: String(err) })
      return []
    }
  }

  async readVisibleMessages(view: WebContentsView, channelId: string): Promise<DashboardStoredMessage[]> {
    try {
      const raw = await view.webContents.executeJavaScript(TEAMS_READ_MESSAGES_SCRIPT, true) as Array<{rawTs:string;sender:string;text:string}>
      const normalized = (raw ?? []).map(r => normalizeScrapedMessage(r, channelId, 'teams'))
      return deduplicateMessages(normalized, channelId)
    } catch (err) {
      log.warn('teams adapter: readVisibleMessages failed', { err: String(err) })
      return []
    }
  }
}
