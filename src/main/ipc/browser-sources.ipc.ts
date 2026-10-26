import type { BrowserWindow } from 'electron'
import { IpcChannels, type ViewportBounds } from '../../shared/ipc-contract'
import type {
  AddBrowserPlatformInput,
  BrowserPlatformConfig
} from '../../shared/browser-sources-contract'
import type { BrowserPlatformStore } from '../browser-sources/browser-platform-store'
import type { BrowserSourceViewManager } from '../browser-sources/browser-source-view-manager'
import { handleInvoke } from './handle'
import { log } from '../logging'

export interface BrowserSourcesIpcDeps {
  platformStore: BrowserPlatformStore
  viewManager: BrowserSourceViewManager
  getMainWindow: () => BrowserWindow | null
}

export function registerBrowserSourcesIpc(deps: BrowserSourcesIpcDeps): void {
  // Forward status changes to renderer
  deps.viewManager.onStatusChange((event) => {
    void deps.platformStore.updateStatus(event.platformId, event.authStatus, event.errorMessage)
    const win = deps.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IpcChannels.BrowserSourceStatusChanged, event)
    }
  })

  handleInvoke(IpcChannels.BrowserSourceList, async () => {
    return deps.platformStore.list()
  })

  handleInvoke(
    IpcChannels.BrowserSourceAdd,
    async (input: AddBrowserPlatformInput): Promise<BrowserPlatformConfig> => {
      return deps.platformStore.add(input)
    }
  )

  handleInvoke(
    IpcChannels.BrowserSourceUpdate,
    async (payload: {
      id: string
      patch: Partial<Pick<BrowserPlatformConfig, 'name' | 'url' | 'icon' | 'order'>>
    }): Promise<BrowserPlatformConfig | null> => {
      return deps.platformStore.update(payload.id, payload.patch)
    }
  )

  handleInvoke(
    IpcChannels.BrowserSourceRemove,
    async (payload: { id: string; clearSession?: boolean }): Promise<boolean> => {
      const win = deps.getMainWindow()
      deps.viewManager.destroy(payload.id, win ?? undefined)
      return deps.platformStore.remove(payload.id, payload.clearSession ?? true)
    }
  )

  handleInvoke(
    IpcChannels.BrowserSourceReorder,
    async (payload: { orderedIds: string[] }): Promise<BrowserPlatformConfig[]> => {
      return deps.platformStore.reorder(payload.orderedIds)
    }
  )

  handleInvoke(
    IpcChannels.BrowserSourceActivate,
    async (payload: { platformId: string; bounds: ViewportBounds }): Promise<boolean> => {
      const config = await deps.platformStore.get(payload.platformId)
      if (!config) {
        log.warn('cannot activate unknown browser source platform', { platformId: payload.platformId })
        return false
      }
      const win = deps.getMainWindow()
      if (!win || win.isDestroyed()) return false

      deps.viewManager.activate(config, win, payload.bounds)
      return true
    }
  )

  handleInvoke(IpcChannels.BrowserSourceDeactivate, async (): Promise<void> => {
    const win = deps.getMainWindow()
    if (win && !win.isDestroyed()) {
      deps.viewManager.deactivate(win)
    }
  })

  handleInvoke(
    IpcChannels.BrowserSourceUpdateBounds,
    async (bounds: ViewportBounds): Promise<void> => {
      deps.viewManager.updateBounds(bounds)
    }
  )

  handleInvoke(
    IpcChannels.BrowserSourceSetEmbedVisible,
    async (payload: { visible: boolean }): Promise<void> => {
      const win = deps.getMainWindow()
      if (win && !win.isDestroyed()) {
        deps.viewManager.setEmbedVisible(win, payload.visible)
      }
    }
  )
}
