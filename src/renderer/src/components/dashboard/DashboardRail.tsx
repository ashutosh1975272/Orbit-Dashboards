import { useDashboardStore } from '../../hooks/useDashboard'
import { useProfileStore } from '../../hooks/useProfiles'
import { BrowserPlatformsRail } from './BrowserPlatformsRail'
import type { BrowserPlatformConfig } from '../../../../shared/browser-sources-contract'
import { useEffect } from 'react'

function mainColumnBounds(): { x: number; y: number; width: number; height: number } | null {
  const el = document.querySelector('.main-column')
  const rect = el?.getBoundingClientRect()
  if (!rect || rect.width < 40 || rect.height < 40) return null
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

export default function DashboardRail(): React.JSX.Element {
  const openDashboard = useDashboardStore((s) => s.openDashboard)
  const closeDashboard = useDashboardStore((s) => s.closeDashboard)
  const dashboardOpen = useDashboardStore((s) => s.dashboardOpen)
  const expanded = useDashboardStore((s) => s.dashRailExpanded)
  const setExpanded = useDashboardStore((s) => s.setDashRailExpanded)
  const activePlatformId = useDashboardStore((s) => s.activeBrowserSourceId)
  const setActivePlatformId = useDashboardStore((s) => s.setActiveBrowserSource)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const activeAppId = useProfileStore((s) => s.activeAppId)

  useEffect(() => {
    if (activePlatformId) {
      setActivePlatformId(null)
    }
    // Switching profile or app must never leave a client web session covering it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, activeAppId])

  useEffect(() => {
    if (!activePlatformId) {
      void window.api?.browserSources?.deactivate?.()
      return
    }

    const report = (): void => {
      const bounds = mainColumnBounds()
      if (bounds) void window.api?.browserSources?.updateBounds?.(bounds)
    }

    const el = document.querySelector('.main-column')
    const observer = el ? new ResizeObserver(report) : null
    if (el && observer) observer.observe(el)
    window.addEventListener('resize', report)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [activePlatformId])

  const deactivateSource = (): void => {
    if (!activePlatformId) return
    setActivePlatformId(null)
    void window.api?.browserSources?.deactivate?.()
  }

  const handleSelectPlatform = async (platform: BrowserPlatformConfig): Promise<void> => {
    const bounds = mainColumnBounds()
    if (!bounds) return

    if (dashboardOpen) closeDashboard()
    setActivePlatformId(platform.id)

    if (typeof window.api?.browserSources?.activate === 'function') {
      const activated = await window.api.browserSources.activate(platform.id, bounds)
      if (!activated) setActivePlatformId(null)
    }
  }

  return (
    <div className="dash-entry" data-testid="dashboard-rail">
      <button
        type="button"
        className={`recent-item dash-entry-row${dashboardOpen ? ' is-active' : ''}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        data-testid="dashboard-toggle"
        title="Dashboard"
      >
        <span className="recent-app-chip dash-entry-glyph" aria-hidden>
          ▦
        </span>
        <span className="ws-copy">
          <span className="ws-title">Dashboard</span>
        </span>
        <span className={`dash-entry-chevron${expanded ? ' open' : ''}`} aria-hidden>
          ▸
        </span>
      </button>

      {expanded ? (
        <div className="dash-entry-apps" role="menu" aria-label="Dashboard apps">
          <button
            type="button"
            role="menuitem"
            className={`recent-item dash-entry-app${dashboardOpen ? ' is-active' : ''}`}
            onClick={() => {
              deactivateSource()
              openDashboard('slack')
            }}
            data-testid="dashboard-app-slack"
          >
            <span className="recent-app-chip dash-entry-glyph" aria-hidden>
              ▤
            </span>
            <span className="ws-copy">
              <span className="ws-title">Project</span>
            </span>
          </button>
        </div>
      ) : null}

      <BrowserPlatformsRail
        activePlatformId={activePlatformId}
        onSelectPlatform={(p) => void handleSelectPlatform(p)}
        onPlatformRemoved={() => setActivePlatformId(null)}
      />
    </div>
  )
}
