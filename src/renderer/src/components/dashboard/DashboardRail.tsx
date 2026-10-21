import type React from 'react'
import { useState } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'

/**
 * Sidebar "Dashboard" top button → dropdown app menu → Slack dashboard page.
 * Rendered as an additive block at the top of the sidebar.
 */
export default function DashboardRail(): React.ReactElement {
  const openDashboard = useDashboardStore((s) => s.openDashboard)
  const dashboardOpen = useDashboardStore((s) => s.dashboardOpen)
  const loading = useDashboardStore((s) => s.loading)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="dash-rail" data-testid="dashboard-rail">
      <button
        type="button"
        className={`dash-toggle${dashboardOpen ? ' active' : ''}`}
        disabled={loading}
        onClick={() => setMenuOpen((v) => !v)}
        data-testid="dashboard-toggle"
        title="Dashboard"
      >
        <span className="dash-toggle-glyph">▦</span> Dashboard
      </button>

      {menuOpen ? (
        <div className="dash-apps" role="menu" aria-label="Dashboard apps">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openDashboard?.('slack')
              setMenuOpen(false)
            }}
            data-testid="dashboard-app-slack"
            data-app-active={dashboardOpen}
          >
            <span className="dash-app-glyph">#</span> Slack
          </button>
        </div>
      ) : null}
    </div>
  )
}
