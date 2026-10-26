export interface PlatformSelectors {
  /** Selector for element indicating logged-in state */
  loggedInIndicator: string
  /** Selector for channel list container in sidebar */
  channelListContainer: string
  /** Selector for channel items */
  channelItem: string
  /** Selector for unread badge or indicator on channel */
  channelUnreadBadge: string
  /** Selector for channel name element */
  channelName: string
  /** Selector for message list container */
  messageListContainer: string
  /** Selector for individual message row */
  messageRow: string
  /** Selector for sender name */
  messageSender: string
  /** Selector for timestamp element */
  messageTimestamp: string
  /** Selector for message body text */
  messageBody: string
}

export const SLACK_SELECTORS: PlatformSelectors = {
  loggedInIndicator: '[data-qa="workspace_navigation"], #client-ui, .p-client_container',
  channelListContainer: '[data-qa="channel_sidebar_name_page"], .p-channel_sidebar__list',
  channelItem: '[data-qa="channel_sidebar_name_page"] [role="treeitem"], .p-channel_sidebar__channel',
  channelUnreadBadge: '.p-channel_sidebar__badge, [data-qa="channel-sidebar-unread-badge"], .c-mention_badge',
  channelName: '.p-channel_sidebar__name, [data-qa="channel_sidebar_name"]',
  messageListContainer: '[data-qa="slack_kit_list"], .c-virtual_list__scroll_container, role="list"',
  messageRow: '[data-qa="message_container"], .c-message_kit__message, .c-virtual_list__item',
  messageSender: '[data-qa="message_sender_name"], .c-message__sender_button',
  messageTimestamp: '[data-qa="timestamp"], .c-timestamp',
  messageBody: '[data-qa="message-text"], .c-message_kit__blocks, .p-rich_text_section'
}

export const TEAMS_SELECTORS: PlatformSelectors = {
  loggedInIndicator: '[data-tid="app-layout"], #teams-app, .app-container',
  channelListContainer: '[data-tid="team-channel-list"], .channel-list',
  channelItem: '[data-tid="channel-list-item"]',
  channelUnreadBadge: '[data-tid="channel-unread-badge"], .unread-badge',
  channelName: '[data-tid="channel-name"]',
  messageListContainer: '[data-tid="chat-message-list"], .message-pane',
  messageRow: '[data-tid="chat-message"], [role="listitem"]',
  messageSender: '[data-tid="message-author-name"]',
  messageTimestamp: '[data-tid="message-timestamp"]',
  messageBody: '[data-tid="message-body"]'
}

export const WHATSAPP_SELECTORS: PlatformSelectors = {
  loggedInIndicator: '#pane-side, [data-testid="chat-list"]',
  channelListContainer: '#pane-side',
  channelItem: '[data-testid="cell-frame-container"], div[role="listitem"]',
  channelUnreadBadge: '[data-testid="icon-unread-count"], span[aria-label*="unread"]',
  channelName: '[data-testid="cell-frame-title"] span',
  messageListContainer: '[data-testid="conversation-panel-messages"]',
  messageRow: '[data-testid="msg-container"], div[role="row"]',
  messageSender: '[data-testid="author"], span[dir="auto"]',
  messageTimestamp: '[data-testid="msg-meta"] span',
  messageBody: '[data-testid="selectable-text"], span.selectable-text'
}

