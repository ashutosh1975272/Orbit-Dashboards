import { useState } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'

/**
 * Native sidebar row rendered after the Recents strip (via dashboardSlot).
 * One simple "Dashboard" row; clicking it expands an inline "Slack" item
 * (same pattern as the profile app sections — no absolute positioning,
 * so it can never be clipped by the rail's overflow rules).
 */
export default function DashboardRail(): React.JSX.Element {
  const openDashboard = useDashboardStore((s) => s.openDashboard)
  const dashboardOpen = useDashboardStore((s) => s.dashboardOpen)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="dash-entry" data-testid="dashboard-rail">
      <button
        type="button"
        className={`recent-item dash-entry-row${dashboardOpen ? ' is-active' : ''}`}
        onClick={() => setExpanded((v) => !v)}
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
              openDashboard('slack')
              setExpanded(false)
            }}
            data-testid="dashboard-app-slack"
          >
            <span className="recent-app-chip dash-entry-glyph" aria-hidden>
              #
            </span>
            <span className="ws-copy">
              <span className="ws-title">Slack</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
