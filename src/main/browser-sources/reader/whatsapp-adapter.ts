import { log } from '../../logging'
import type { WebContentsView } from 'electron'
import type { DashboardStoredMessage } from '../../dashboard/delta-store'
import type { PlatformReaderAdapter, ScrapedChannelInfo } from './adapter-interface'
import { deduplicateMessages, normalizeScrapedMessage } from './normalizer'

// WhatsApp is strictly read-only. No write/send helpers exist here.

export const WHATSAPP_READ_CHATS_SCRIPT = `
(function() {
  const results = [];
  const items = document.querySelectorAll('[data-testid="cell-frame-container"], div[role="listitem"]');
  items.forEach(item => {
    const badge = item.querySelector('[data-testid="icon-unread-count"], span[aria-label*="unread"]');
    const nameEl = item.querySelector('[data-testid="cell-frame-title"] span');
    if (nameEl) {
      results.push({ id: nameEl.textContent?.trim() || '', name: nameEl.textContent?.trim() || '', hasUnread: !!badge });
    }
  });
  return results;
})()
`

export const WHATSAPP_READ_MESSAGES_SCRIPT = `
(function() {
  const results = [];
  const rows = document.querySelectorAll('[data-testid="msg-container"], div[role="row"]');
  rows.forEach(row => {
    const senderEl = row.querySelector('[data-testid="author"], span[dir="auto"]');
    const tsEl = row.querySelector('[data-testid="msg-meta"] span');
    const bodyEl = row.querySelector('[data-testid="selectable-text"], span.selectable-text');
    const ts = tsEl?.textContent?.trim() || '';
    const text = bodyEl?.innerText?.trim() || bodyEl?.textContent?.trim() || '';
    const sender = senderEl?.textContent?.trim() || '';
    if (text) results.push({ rawTs: ts || String(Date.now()/1000), sender, text });
  });
  return results;
})()
`

export class WhatsAppBrowserAdapter implements PlatformReaderAdapter {
  readonly platformType = 'whatsapp' as const

  async detectLoggedIn(view: WebContentsView): Promise<boolean> {
    try {
      const r = await view.webContents.executeJavaScript(
        `Boolean(document.querySelector('#pane-side, [data-testid="chat-list"]'))`, true)
      return Boolean(r)
    } catch { return false }
  }

  async listUnreadChannels(view: WebContentsView): Promise<ScrapedChannelInfo[]> {
    try {
      const raw = await view.webContents.executeJavaScript(WHATSAPP_READ_CHATS_SCRIPT, true) as Array<{id:string;name:string;hasUnread:boolean}>
      return (raw ?? []).filter(c => c.hasUnread && c.id)
    } catch (err) {
      log.warn('whatsapp adapter: listUnreadChannels failed', { err: String(err) })
      return []
    }
  }

  async readVisibleMessages(view: WebContentsView, channelId: string): Promise<DashboardStoredMessage[]> {
    try {
      const raw = await view.webContents.executeJavaScript(WHATSAPP_READ_MESSAGES_SCRIPT, true) as Array<{rawTs:string;sender:string;text:string}>
      const normalized = (raw ?? []).map(r => normalizeScrapedMessage(r, channelId, 'whatsapp'))
      return deduplicateMessages(normalized, channelId)
    } catch (err) {
      log.warn('whatsapp adapter: readVisibleMessages failed', { err: String(err) })
      return []
    }
  }
}
