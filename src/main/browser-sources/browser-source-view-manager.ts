import { WebContentsView, shell, type BrowserWindow, type Rectangle } from 'electron'
import { log } from '../logging'
import type {
  BrowserPlatformConfig,
  BrowserSourceAuthStatus,
  BrowserSourceStatusEvent
} from './browser-source-types'
import {
  browserSourceSessionWebPreferences,
  isAllowedEmbedDomain,
  partitionForBrowserSource
} from './session-partition'

export class BrowserSourceViewManager {
  private readonly views = new Map<string, WebContentsView>()
  private readonly configs = new Map<string, BrowserPlatformConfig>()
  private readonly statusMap = new Map<string, BrowserSourceAuthStatus>()
  private activePlatformId: string | null = null
  private lastBounds: Rectangle | null = null
  private embedHidden = false
  private readonly statusListeners = new Set<(event: BrowserSourceStatusEvent) => void>()

  getActivePlatformId(): string | null {
    return this.activePlatformId
  }

  getView(platformId: string): WebContentsView | undefined {
    return this.views.get(platformId)
  }

  getStatus(platformId: string): BrowserSourceAuthStatus {
    return this.statusMap.get(platformId) ?? 'needs_login'
  }

  onStatusChange(listener: (event: BrowserSourceStatusEvent) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private emitStatus(
    platformId: string,
    authStatus: BrowserSourceAuthStatus,
    errorMessage?: string
  ): void {
    const prev = this.statusMap.get(platformId)
    this.statusMap.set(platformId, authStatus)
    if (prev !== authStatus || errorMessage) {
      const event: BrowserSourceStatusEvent = {
        platformId,
        authStatus,
        lastCheckedAt: new Date().toISOString(),
        errorMessage
      }
      for (const listener of this.statusListeners) {
        try {
          listener(event)
        } catch (err) {
          log.warn('browser source status listener error', { platformId, err: String(err) })
        }
      }
    }
  }

  getOrCreate(config: BrowserPlatformConfig, preloadPath?: string): WebContentsView {
    this.configs.set(config.id, config)
    const existing = this.views.get(config.id)
    if (existing) {
      return existing
    }

    const webPrefs = browserSourceSessionWebPreferences(config.id, preloadPath)
    const view = new WebContentsView({ webPreferences: webPrefs })
    view.webContents.setZoomFactor(1)

    this.wireNavigation(config, view)
    this.wireStatusDetection(config, view)

    void view.webContents.loadURL(config.url)
    this.views.set(config.id, view)

    log.info('browser source view created', {
      platformId: config.id,
      type: config.type,
      partition: partitionForBrowserSource(config.id)
    })

    return view
  }

  private wireNavigation(config: BrowserPlatformConfig, view: WebContentsView): void {
    view.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('msteams:') || url.startsWith('slack:')) {
        event.preventDefault()
        void view.webContents.loadURL(config.url)
        return
      }

      if (!url.startsWith('http')) {
        event.preventDefault()
        return
      }

      if (!isAllowedEmbedDomain(url, config.type, config.url)) {
        event.preventDefault()
        log.info('browser source in-page navigation redirected to default browser', {
          platformId: config.id,
          url
        })
        if (typeof shell?.openExternal === 'function') {
          void shell.openExternal(url)
        }
      }
    })

    view.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('msteams:') || url.startsWith('slack:')) {
        log.info('blocked protocol scheme in browser source; loading in web view', {
          platformId: config.id,
          url
        })
        void view.webContents.loadURL(config.url)
        return { action: 'deny' }
      }

      const isAllowed = isAllowedEmbedDomain(url, config.type, config.url)
      if (isAllowed) {
        log.info('browser source in-place navigation allowed', { platformId: config.id, url })
        void view.webContents.loadURL(url)
      } else {
        log.info('browser source external navigation redirected to default browser', {
          platformId: config.id,
          url
        })
        if (typeof shell?.openExternal === 'function') {
          void shell.openExternal(url)
        }
      }
      return { action: 'deny' }
    })
  }

  private wireStatusDetection(config: BrowserPlatformConfig, view: WebContentsView): void {
    const check = async (): Promise<void> => {
      if (view.webContents.isDestroyed()) return
      await this.evaluateAuthStatus(config, view)
    }

    view.webContents.on('did-finish-load', () => void check())
    view.webContents.on('dom-ready', () => void check())
    view.webContents.on('did-fail-load', (_evt, errorCode, errorDescription) => {
      if (errorCode === -3) return // aborted/redirected
      this.emitStatus(
        config.id,
        'adapter_broken',
        `Failed to load (${errorCode}): ${errorDescription}`
      )
    })
  }

  async evaluateAuthStatus(
    config: BrowserPlatformConfig,
    view: WebContentsView
  ): Promise<BrowserSourceAuthStatus> {
    try {
      const currentUrl = view.webContents.getURL() || ''

      if (config.type === 'slack') {
        if (currentUrl.includes('/client/') || currentUrl.includes('/messages/')) {
          this.emitStatus(config.id, 'logged_in')
          return 'logged_in'
        }
        if (
          currentUrl.includes('slack.com/signin') ||
          currentUrl.includes('slack.com/get-started')
        ) {
          this.emitStatus(config.id, 'needs_login')
          return 'needs_login'
        }
        // In-page check
        const hasUi = await view.webContents.executeJavaScript(
          `Boolean(document.querySelector('[data-qa="workspace_navigation"]') || document.querySelector('#client-ui'))`,
          true
        )
        if (hasUi) {
          this.emitStatus(config.id, 'logged_in')
          return 'logged_in'
        }
      } else if (config.type === 'teams') {
        if (
          currentUrl.includes('teams.microsoft.com/v2/') &&
          !currentUrl.includes('login.microsoftonline.com')
        ) {
          this.emitStatus(config.id, 'logged_in')
          return 'logged_in'
        }
        if (
          currentUrl.includes('login.microsoftonline.com') ||
          currentUrl.includes('teams.microsoft.com/landing')
        ) {
          this.emitStatus(config.id, 'needs_login')
          return 'needs_login'
        }
      } else if (config.type === 'whatsapp') {
        if (currentUrl.includes('web.whatsapp.com')) {
          const hasQr = await view.webContents
            .executeJavaScript(
              `Boolean(document.querySelector('canvas[aria-label*="QR"]') || document.querySelector('[data-ref] canvas'))`,
              true
            )
            .catch(() => false)

          if (hasQr) {
            this.emitStatus(config.id, 'needs_login')
            return 'needs_login'
          }

          const hasChats = await view.webContents
            .executeJavaScript(
              `Boolean(document.querySelector('#pane-side') || document.querySelector('[data-testid="chat-list"]'))`,
              true
            )
            .catch(() => false)

          if (hasChats) {
            this.emitStatus(config.id, 'logged_in')
            return 'logged_in'
          }
        }
      } else {
        // custom or generic
        if (currentUrl.startsWith('http')) {
          this.emitStatus(config.id, 'logged_in')
          return 'logged_in'
        }
      }

      this.emitStatus(config.id, 'needs_login')
      return 'needs_login'
    } catch (err) {
      log.warn('browser source status check error', { platformId: config.id, err: String(err) })
      this.emitStatus(config.id, 'adapter_broken', String(err))
      return 'adapter_broken'
    }
  }

  activate(
    config: BrowserPlatformConfig,
    mainWindow: BrowserWindow,
    bounds: Rectangle,
    preloadPath?: string
  ): WebContentsView {
    const next = this.getOrCreate(config, preloadPath)
    this.lastBounds = bounds

    if (this.activePlatformId && this.activePlatformId !== config.id) {
      const prev = this.views.get(this.activePlatformId)
      if (prev && mainWindow.contentView.children.includes(prev)) {
        mainWindow.contentView.removeChildView(prev)
      }
    }

    this.activePlatformId = config.id

    if (this.embedHidden) {
      log.info('browser source view activated (hidden for overlay)', { platformId: config.id })
      return next
    }

    if (!mainWindow.contentView.children.includes(next)) {
      mainWindow.contentView.addChildView(next)
    }
    next.setBounds(bounds)
    log.info('browser source view activated', { platformId: config.id, bounds })
    return next
  }

  deactivate(mainWindow: BrowserWindow): void {
    if (!this.activePlatformId) return
    const view = this.views.get(this.activePlatformId)
    if (view && mainWindow.contentView.children.includes(view)) {
      mainWindow.contentView.removeChildView(view)
    }
    this.activePlatformId = null
  }

  updateBounds(bounds: Rectangle): void {
    this.lastBounds = bounds
    if (this.activePlatformId) {
      const view = this.views.get(this.activePlatformId)
      if (view) {
        view.setBounds(bounds)
      }
    }
  }

  setEmbedVisible(mainWindow: BrowserWindow, visible: boolean): void {
    if (visible) {
      this.embedHidden = false
      if (this.activePlatformId) {
        const view = this.views.get(this.activePlatformId)
        if (view) {
          if (!mainWindow.contentView.children.includes(view)) {
            mainWindow.contentView.addChildView(view)
          }
          if (this.lastBounds) view.setBounds(this.lastBounds)
        }
      }
      return
    }

    this.embedHidden = true
    if (this.activePlatformId) {
      const view = this.views.get(this.activePlatformId)
      if (view && mainWindow.contentView.children.includes(view)) {
        mainWindow.contentView.removeChildView(view)
      }
    }
  }

  destroy(platformId: string, mainWindow?: BrowserWindow): void {
    const view = this.views.get(platformId)
    if (!view) return

    if (mainWindow && mainWindow.contentView.children.includes(view)) {
      mainWindow.contentView.removeChildView(view)
    }

    if (this.activePlatformId === platformId) {
      this.activePlatformId = null
    }

    try {
      if (!view.webContents.isDestroyed()) {
        view.webContents.close()
      }
    } catch {
      /* ignore */
    }

    this.views.delete(platformId)
    this.configs.delete(platformId)
    this.statusMap.delete(platformId)
    log.info('browser source view destroyed', { platformId })
  }

  destroyAll(mainWindow?: BrowserWindow): void {
    for (const platformId of [...this.views.keys()]) {
      this.destroy(platformId, mainWindow)
    }
  }
}
