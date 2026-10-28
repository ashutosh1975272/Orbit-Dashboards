import type { WebContentsView } from 'electron'
import { SLACK_SELECTORS } from './slack-selectors'
import type { RawScrapedMessage } from './normalizer'

export type SlackSessionState = 'logged_in' | 'needs_login' | 'challenge' | 'unknown'

export interface ScrapedChannelItem {
  id: string
  name: string
  isPrivate: boolean
  hasUnread: boolean
}

/**
 * Passive, read-only script evaluated in the page context to detect authentication/session state.
 */
export const DETECT_STATE_SCRIPT = `
(function() {
  const url = window.location.href;
  if (url.includes('/signin') || url.includes('/oauth')) {
    return 'needs_login';
  }
  if (document.querySelector('${SLACK_SELECTORS.challengeIndicator}')) {
    return 'challenge';
  }
  if (
    url.includes('/client/') ||
    url.includes('/messages/') ||
    document.querySelector('${SLACK_SELECTORS.loggedInIndicator}')
  ) {
    return 'logged_in';
  }
  return 'unknown';
})()
`

/**
 * Passive script to list channels and their unread status from the sidebar DOM.
 */
export const LIST_CHANNELS_SCRIPT = `
(function() {
  const channels = [];
  const items = document.querySelectorAll('${SLACK_SELECTORS.channelItem}');
  items.forEach((item) => {
    const nameEl = item.querySelector('${SLACK_SELECTORS.channelName}');
    const badgeEl = item.querySelector('${SLACK_SELECTORS.channelUnreadBadge}');
    const linkEl = item.querySelector('a[href]');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return;

    let id = '';
    const href = linkEl ? linkEl.getAttribute('href') || '' : '';
    const match = href.match(/\\/messages\\/([^/?]+)/);
    if (match && match[1]) {
      id = match[1];
    } else {
      id = name.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    }

    const ariaLabel = item.getAttribute('aria-label') || '';
    const isPrivate = ariaLabel.toLowerCase().includes('private') || name.startsWith('🔒');

    channels.push({
      id,
      name,
      isPrivate,
      hasUnread: Boolean(badgeEl)
    });
  });
  return channels;
})()
`

/**
 * Passive script to read visible messages from the virtualized message list DOM.
 * Performs ZERO typing, ZERO sending, ZERO clicking.
 */
export const READ_VISIBLE_MESSAGES_SCRIPT = `
(function() {
  const rows = document.querySelectorAll('${SLACK_SELECTORS.messageRow}');
  const results = [];

  rows.forEach((row) => {
    const senderEl = row.querySelector('${SLACK_SELECTORS.messageSender}');
    const tsEl = row.querySelector('${SLACK_SELECTORS.messageTimestamp}');
    const bodyEl = row.querySelector('${SLACK_SELECTORS.messageBody}');

    // Extract timestamp from data-ts attribute or inner text
    let rawTs = tsEl ? (tsEl.getAttribute('data-ts') || tsEl.getAttribute('datetime') || tsEl.textContent.trim()) : '';
    const sender = senderEl ? senderEl.textContent.trim() : 'Anonymous';
    const text = bodyEl ? (bodyEl.innerText || bodyEl.textContent || '').trim() : '';

    const permalinkEl = row.querySelector('a[href*="/archives/"]');
    const permalink = permalinkEl ? permalinkEl.getAttribute('href') : '';

    if (rawTs && text) {
      results.push({
        rawTs,
        sender,
        text,
        permalink: permalink || undefined
      });
    }
  });

  return results;
})()
`

export class SlackAdapter {
  async detectState(view: WebContentsView): Promise<SlackSessionState> {
    if (view.webContents.isDestroyed()) return 'unknown'
    try {
      const state = (await view.webContents.executeJavaScript(DETECT_STATE_SCRIPT, true)) as SlackSessionState
      return state ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async listChannels(view: WebContentsView): Promise<ScrapedChannelItem[]> {
    if (view.webContents.isDestroyed()) return []
    try {
      const channels = (await view.webContents.executeJavaScript(LIST_CHANNELS_SCRIPT, true)) as ScrapedChannelItem[]
      return Array.isArray(channels) ? channels : []
    } catch {
      return []
    }
  }

  async readVisibleMessages(view: WebContentsView): Promise<RawScrapedMessage[]> {
    if (view.webContents.isDestroyed()) return []
    try {
      const messages = (await view.webContents.executeJavaScript(READ_VISIBLE_MESSAGES_SCRIPT, true)) as RawScrapedMessage[]
      return Array.isArray(messages) ? messages : []
    } catch {
      return []
    }
  }
}
