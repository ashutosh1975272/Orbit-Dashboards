import { describe, expect, it, vi } from 'vitest'
import {
  isAllowedEmbedDomain,
  partitionForBrowserSource,
  safeHostname
} from '../../src/main/browser-sources/session-partition'
import { BrowserSourceViewManager } from '../../src/main/browser-sources/browser-source-view-manager'
import type { BrowserPlatformConfig } from '../../src/main/browser-sources/browser-source-types'

describe('Browser Sources Shell (BS-1)', () => {
  describe('session partitions and naming', () => {
    it('creates isolated partitions with persist:bs-<platformId>', () => {
      expect(partitionForBrowserSource('slack-1')).toBe('persist:bs-slack-1')
      expect(partitionForBrowserSource('teams-client-acme')).toBe('persist:bs-teams-client-acme')
      expect(partitionForBrowserSource('custom_link_99')).toBe('persist:bs-custom-link-99')
      expect(partitionForBrowserSource('UPWORK_PROJ')).toBe('persist:bs-upwork-proj')
    })

    it('extracts hostnames safely', () => {
      expect(safeHostname('https://app.slack.com/client/T123/C456')).toBe('app.slack.com')
      expect(safeHostname('https://teams.microsoft.com/v2/')).toBe('teams.microsoft.com')
      expect(safeHostname('invalid-url')).toBe('')
    })
  })

  describe('domain navigation allowlist', () => {
    it('allows Slack and common corporate SSO domains for slack platform', () => {
      expect(isAllowedEmbedDomain('https://app.slack.com/client/T1/C1', 'slack')).toBe(true)
      expect(isAllowedEmbedDomain('https://edge.slack-msgs.com/messages', 'slack')).toBe(true)
      expect(isAllowedEmbedDomain('https://accounts.google.com/o/oauth2/auth', 'slack')).toBe(true)
      expect(isAllowedEmbedDomain('https://login.microsoftonline.com/common', 'slack')).toBe(true)
      expect(isAllowedEmbedDomain('https://mycompany.okta.com/login', 'slack')).toBe(true)
      // External links disallowed in embed
      expect(isAllowedEmbedDomain('https://malicious-site.com', 'slack')).toBe(false)
      expect(isAllowedEmbedDomain('https://github.com/torvalds/linux', 'slack')).toBe(false)
    })

    it('allows Teams domains and Microsoft identity hosts', () => {
      expect(isAllowedEmbedDomain('https://teams.microsoft.com/v2/', 'teams')).toBe(true)
      expect(isAllowedEmbedDomain('https://login.live.com/oauth', 'teams')).toBe(true)
      expect(isAllowedEmbedDomain('https://evil-phishing.com', 'teams')).toBe(false)
    })

    it('allows WhatsApp domains', () => {
      expect(isAllowedEmbedDomain('https://web.whatsapp.com', 'whatsapp')).toBe(true)
      expect(isAllowedEmbedDomain('https://wa.me/settings', 'whatsapp')).toBe(true)
      expect(isAllowedEmbedDomain('https://random-external.com', 'whatsapp')).toBe(false)
    })

    it('allows Custom base domain and SSO redirects', () => {
      const customUrl = 'https://app.acmecorp.internal/dashboard'
      expect(isAllowedEmbedDomain('https://app.acmecorp.internal/tasks', 'custom', customUrl)).toBe(true)
      expect(isAllowedEmbedDomain('https://accounts.google.com/signin', 'custom', customUrl)).toBe(true)
      expect(isAllowedEmbedDomain('https://unrelated-domain.org', 'custom', customUrl)).toBe(false)
    })
  })

  describe('BrowserSourceViewManager lifecycle and status management', () => {
    it('tracks active platform and emits status changes', () => {
      const manager = new BrowserSourceViewManager()
      const events: any[] = []
      const unsubscribe = manager.onStatusChange((evt) => events.push(evt))

      expect(manager.getActivePlatformId()).toBeNull()
      expect(manager.getStatus('platform-1')).toBe('needs_login')

      // Mock emitting status
      ;(manager as any).emitStatus('platform-1', 'logged_in')
      expect(manager.getStatus('platform-1')).toBe('logged_in')
      expect(events.length).toBe(1)
      expect(events[0].platformId).toBe('platform-1')
      expect(events[0].authStatus).toBe('logged_in')

      // Changing to adapter_broken with error message
      ;(manager as any).emitStatus('platform-1', 'adapter_broken', 'Selector timed out')
      expect(manager.getStatus('platform-1')).toBe('adapter_broken')
      expect(events.length).toBe(2)
      expect(events[1].errorMessage).toBe('Selector timed out')

      unsubscribe()
      ;(manager as any).emitStatus('platform-1', 'needs_login')
      expect(events.length).toBe(2) // No new event after unsubscribe
    })

    it('manages active platform switching and destruction', () => {
      const manager = new BrowserSourceViewManager()
      const mockChildViews: any[] = []
      const mockMainWindow: any = {
        contentView: {
          children: mockChildViews,
          addChildView: vi.fn((v) => mockChildViews.push(v)),
          removeChildView: vi.fn((v) => {
            const idx = mockChildViews.indexOf(v)
            if (idx >= 0) mockChildViews.splice(idx, 1)
          })
        }
      }

      const mockView1: any = {
        webContents: {
          isDestroyed: () => false,
          loadURL: vi.fn().mockResolvedValue(undefined),
          setZoomFactor: vi.fn(),
          setWindowOpenHandler: vi.fn(),
          on: vi.fn()
        },
        setBounds: vi.fn()
      }

      ;(manager as any).views.set('p1', mockView1)
      ;(manager as any).configs.set('p1', {
        id: 'p1',
        name: 'Slack',
        type: 'slack',
        url: 'https://app.slack.com',
        partition: 'persist:bs-p1',
        authStatus: 'logged_in',
        createdAt: new Date().toISOString()
      } as BrowserPlatformConfig)

      // Activate p1
      manager.activate(
        { id: 'p1' } as any,
        mockMainWindow,
        { x: 300, y: 0, width: 800, height: 600 }
      )

      expect(manager.getActivePlatformId()).toBe('p1')
      expect(mockMainWindow.contentView.addChildView).toHaveBeenCalledWith(mockView1)
      expect(mockView1.setBounds).toHaveBeenCalledWith({ x: 300, y: 0, width: 800, height: 600 })

      // Update bounds
      manager.updateBounds({ x: 350, y: 0, width: 850, height: 650 })
      expect(mockView1.setBounds).toHaveBeenCalledWith({ x: 350, y: 0, width: 850, height: 650 })

      // Deactivate
      manager.deactivate(mockMainWindow)
      expect(manager.getActivePlatformId()).toBeNull()
      expect(mockMainWindow.contentView.removeChildView).toHaveBeenCalledWith(mockView1)

      // Destroy
      manager.destroy('p1', mockMainWindow)
      expect(manager.getView('p1')).toBeUndefined()
    })
  })
})
