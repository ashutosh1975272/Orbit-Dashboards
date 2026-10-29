import { WebContentsView } from 'electron'
import { partitionForProfile } from '../profiles/session-partition'
import { log } from '../logging'
import { SlackAdapter, type SlackSessionState, type ScrapedChannelItem } from './slack-adapter'
import { deduplicateMessages, normalizeScrapedMessage } from './normalizer'
import type { DashboardStoredMessage } from '../dashboard/delta-store'

export interface SlackReaderOptions {
  profileId: string
  workspaceId: string
}

export class SlackReaderView {
  private view: WebContentsView | null = null
  private readonly adapter = new SlackAdapter()
  private readonly profileId: string
  private readonly workspaceId: string

  constructor(options: SlackReaderOptions) {
    this.profileId = options.profileId
    this.workspaceId = options.workspaceId
  }

  /**
   * Initializes the hidden background view using the profile's dedicated session partition.
   * Completely isolated and hidden from view.
   */
  async initialize(): Promise<void> {
    if (this.view && !this.view.webContents.isDestroyed()) return

    const partition = partitionForProfile(this.profileId, 'slack')

    this.view = new WebContentsView({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    // Strict URL allowlist: reader view only loads Slack domain URLs
    this.view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.view.webContents.on('will-navigate', (event, url) => {
      try {
        const parsed = new URL(url)
        if (!parsed.hostname.endsWith('slack.com')) {
          event.preventDefault()
          log.warn('slack reader blocked external navigation', { url })
        }
      } catch {
        event.preventDefault()
      }
    })

    // Position view offscreen so it runs 100% passively in the background
    this.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 })
  }

  async checkState(): Promise<SlackSessionState> {
    if (!this.view) await this.initialize()
    return this.adapter.detectState(this.view!)
  }

  async listChannels(): Promise<ScrapedChannelItem[]> {
    if (!this.view) await this.initialize()
    const state = await this.checkState()
    if (state !== 'logged_in') return []
    return this.adapter.listChannels(this.view!)
  }

  /**
   * Reads visible messages from a specific channel by passive deep-link navigation.
   * Performs ZERO clicking, typing, or API token extraction.
   */
  async readChannelMessages(channelId: string): Promise<DashboardStoredMessage[]> {
    if (!this.view) await this.initialize()
    const state = await this.checkState()
    if (state !== 'logged_in') {
      log.info('slack reader cannot read channel: session not logged in', { state })
      return []
    }

    const channelUrl = `https://app.slack.com/client/${this.workspaceId}/${channelId}`
    const currentUrl = this.view!.webContents.getURL()

    if (!currentUrl.includes(`/${this.workspaceId}/${channelId}`)) {
      await this.view!.webContents.loadURL(channelUrl)
      // Allow DOM to settle passively
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }

    const rawMessages = await this.adapter.readVisibleMessages(this.view!)
    const normalized: DashboardStoredMessage[] = []

    for (const raw of rawMessages) {
      const msg = normalizeScrapedMessage(raw, channelId)
      if (msg) normalized.push(msg)
    }

    return deduplicateMessages(this.workspaceId, channelId, normalized)
  }

  /**
   * Navigates to the channel and posts a message via DOM input fallback.
   */
  async postChannelMessage(channelId: string, text: string): Promise<boolean> {
    if (!this.view) await this.initialize()
    const state = await this.checkState()
    if (state !== 'logged_in') return false

    const channelUrl = `https://app.slack.com/client/${this.workspaceId}/${channelId}`
    const currentUrl = this.view!.webContents.getURL()

    if (!currentUrl.includes(`/${this.workspaceId}/${channelId}`)) {
      await this.view!.webContents.loadURL(channelUrl)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    return this.adapter.postMessageViaDom(this.view!, text)
  }

  destroy(): void {
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.view.webContents.close()
    }
    this.view = null
  }
}
