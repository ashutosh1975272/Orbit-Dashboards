import { useDashboardStore } from '../../hooks/useDashboard'
import { BrowserPlatformsRail } from './BrowserPlatformsRail'
import type { BrowserPlatformConfig } from '../../../../shared/browser-sources-contract'
import { useState } from 'react'

export default function DashboardRail(): React.JSX.Element {
  const openDashboard = useDashboardStore((s) => s.openDashboard)
  const dashboardOpen = useDashboardStore((s) => s.dashboardOpen)
  const expanded = useDashboardStore((s) => s.dashRailExpanded)
  const setExpanded = useDashboardStore((s) => s.setDashRailExpanded)
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null)

  const handleSelectPlatform = async (platform: BrowserPlatformConfig): Promise<void> => {
    setActivePlatformId(platform.id)
    const el = document.querySelector('[data-testid="slack-viewport"]')
    const rect = el?.getBoundingClientRect()
    const bounds = rect
      ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      : { x: 300, y: 0, width: 800, height: 600 }

    if (typeof window.api?.browserSources?.activate === 'function') {
      await window.api.browserSources.activate(platform.id, bounds)
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
              setActivePlatformId(null)
              if (typeof window.api?.browserSources?.deactivate === 'function') {
                void window.api.browserSources.deactivate()
              }
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
      />
    </div>
  )
}
