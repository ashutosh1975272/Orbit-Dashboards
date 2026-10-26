import { log } from '../../logging'
import type { WebContentsView } from 'electron'
import type { DashboardStoredMessage } from '../../dashboard/delta-store'
import type { PlatformReaderAdapter, ScrapedChannelInfo } from './adapter-interface'
import { deduplicateMessages, normalizeScrapedMessage } from './normalizer'

export const READ_UNREAD_CHANNELS_SCRIPT = `
(function() {
  const results = [];
  const items = document.querySelectorAll('.p-channel_sidebar__channel, [data-qa="channel_sidebar_name_page"] [role="treeitem"]');
  items.forEach(item => {
    const badge = item.querySelector('.c-mention_badge, .p-channel_sidebar__badge, [data-qa="channel-sidebar-unread-badge"]');
    const nameEl = item.querySelector('.p-channel_sidebar__name, [data-qa="channel_sidebar_name"]');
    const link = item.querySelector('a[href]');
    if (nameEl) {
      const idMatch = link?.href?.match(/\\/messages\\/([^/?]+)/);
      results.push({
        id: idMatch?.[1] || nameEl.textContent?.trim() || '',
        name: nameEl.textContent?.trim() || '',
        hasUnread: !!badge
      });
    }
  });
  return results;
})()
`

export const READ_MESSAGES_SCRIPT = `
(function() {
  const results = [];
  const rows = document.querySelectorAll('[data-qa="message_container"], .c-message_kit__message, .c-virtual_list__item');
  rows.forEach(row => {
    const senderEl = row.querySelector('[data-qa="message_sender_name"], .c-message__sender_button');
    const tsEl = row.querySelector('[data-qa="timestamp"], .c-timestamp');
    const bodyEl = row.querySelector('[data-qa="message-text"], .c-message_kit__blocks .p-rich_text_section');
    const ts = tsEl?.getAttribute('data-ts') || tsEl?.textContent?.trim() || '';
    const text = bodyEl?.innerText?.trim() || bodyEl?.textContent?.trim() || '';
    const sender = senderEl?.textContent?.trim() || '';
    if (text) {
      results.push({ rawTs: ts || String(Date.now()/1000), sender, text });
    }
  });
  return results;
})()
`

export class SlackBrowserAdapter implements PlatformReaderAdapter {
  readonly platformType = 'slack' as const

  async detectLoggedIn(view: WebContentsView): Promise<boolean> {
    try {
      const url = view.webContents.getURL()
      if (url.includes('/client/') || url.includes('/messages/')) return true
      const result = await view.webContents.executeJavaScript(
        `Boolean(document.querySelector('#client-ui, [data-qa="workspace_navigation"], .p-client_container'))`,
        true
      )
      return Boolean(result)
    } catch {
      return false
    }
  }

  async listUnreadChannels(view: WebContentsView): Promise<ScrapedChannelInfo[]> {
    try {
      const raw = await view.webContents.executeJavaScript(READ_UNREAD_CHANNELS_SCRIPT, true) as Array<{id:string;name:string;hasUnread:boolean}>
      return (raw ?? []).filter(c => c.hasUnread && c.id)
    } catch (err) {
      log.warn('slack adapter: listUnreadChannels failed', { err: String(err) })
      return []
    }
  }

  async readVisibleMessages(view: WebContentsView, channelId: string): Promise<DashboardStoredMessage[]> {
    try {
      const raw = await view.webContents.executeJavaScript(READ_MESSAGES_SCRIPT, true) as Array<{rawTs:string;sender:string;text:string}>
      const normalized = (raw ?? []).map(r => normalizeScrapedMessage(r, channelId, 'slack'))
      return deduplicateMessages(normalized, channelId)
    } catch (err) {
      log.warn('slack adapter: readVisibleMessages failed', { err: String(err) })
      return []
    }
  }
}
