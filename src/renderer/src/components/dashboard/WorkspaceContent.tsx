import type React from 'react'
import type { CardView, CardSummary } from './card-view'
import type { DashboardProject } from '../../../../shared/dashboard-contract'
import CentreContent from './CentreContent'
import CentreVisuals from './CentreVisuals'
import NavIcon from './nav-icons'
import { DetailBody, GuideDetailBody } from './guide-content'
import SlackChatTab from './SlackChatTab'
import ProjectSettingsTab from './ProjectSettingsTab'
import AgentChatPanel from './AgentChatPanel'
import {
  detailKeyOf,
  guideSectionOf,
  isDetailId,
  isGuideId,
  isVisualId,
  navRowOf,
  slackSourceOf,
  visualKeyOf,
  xomniModeOf,
  type OpenGroup,
  type WorkspaceNavState
} from './workspace-nav'

interface WorkspaceContentProps {
  view: CardView
  summary: CardSummary
  project: DashboardProject
  nav: WorkspaceNavState
}

/** Headings for the bodies no row owns. */
const GROUP_META: Record<OpenGroup, { title: string; desc: string }> = {
  dash: { title: 'Dashboard', desc: 'Everything about this project at a glance.' },
  xomni: { title: 'Xomni', desc: 'Chat with this project.' },
  slack: { title: 'Slack', desc: 'Messages from the connected workspaces.' },
  info: { title: 'Project info', desc: 'What this card has learned about the project.' },
  viz: { title: 'Visualizations', desc: 'Charts built from this project’s own numbers.' },
  settings: { title: 'Settings', desc: 'Model, key, channels and dates for this card.' }
}

function panelMeta(nav: WorkspaceNavState): { title: string; desc: string } {
  const row = navRowOf(nav.selection)
  if (row) return { title: row.label, desc: row.desc }
  return GROUP_META[nav.openGroup]
}

export default function WorkspaceContent({
  view,
  summary,
  project,
  nav
}: WorkspaceContentProps): React.ReactElement {
  const { centre, leftSidebar, rightSidebar, identity } = view
  const { title, desc } = panelMeta(nav)
  const sel = nav.selection

  let body: React.ReactNode
  let bare = false

  if (nav.openGroup === 'xomni') {
    body = (
      <AgentChatPanel
        projectName={identity.name}
        projectId={summary.projectId}
        mode={xomniModeOf(nav)}
      />
    )
    bare = true
  } else if (nav.openGroup === 'slack') {
    if (slackSourceOf(nav) === 'team') {
      body = (
        <div className="ws-agent">
          <div className="ws-agent-empty">
            <span className="ws-agent-empty-icon">
              <NavIcon name="slack" />
            </span>
            <p className="ws-agent-empty-title">Connect workspace</p>
            <p className="ws-agent-empty-hint">
              Our team&apos;s workspace is connected once for all cards, from the dashboard&apos;s
              settings menu. It isn&apos;t connected yet, so there is nothing to show here — the
              channels our team pins for this project appear in this panel once it is.
            </p>
          </div>
        </div>
      )
    } else {
      body = (
        <SlackChatTab
          projectId={summary.projectId}
          channels={identity.channels.map((c) => ({
            channelId: c.channelId,
            channelName: c.channelName
          }))}
        />
      )
    }
    bare = true
  } else if (nav.openGroup === 'settings') {
    body = <ProjectSettingsTab project={project} />
  } else if (nav.openGroup === 'viz') {
    body = (
      <CentreVisuals
        visuals={centre.visuals}
        only={sel && isVisualId(sel) ? visualKeyOf(sel) : undefined}
      />
    )
  } else if (nav.openGroup === 'info') {
    if (sel && isDetailId(sel)) {
      body = <DetailBody data={rightSidebar} detailKey={detailKeyOf(sel)} />
    } else if (sel && isGuideId(sel)) {
      body = <GuideDetailBody data={leftSidebar} section={guideSectionOf(sel)} />
    } else {
      // Project info has no body of its own — only rows do. Reaching it from
      // the rail before picking a row must not pretend to be the Dashboard.
      body = (
        <p className="ws-empty">
          Pick a row under Project info — needs reply, blockers, requirements, history — to see
          what this card has learned.
        </p>
      )
    }
  } else {
    // dash — the project overview
    body = <CentreContent centre={centre} />
  }

  if (bare) {
    return (
      <section className="ws-content is-bare" aria-label={title}>
        {body}
      </section>
    )
  }

  return (
    <section className="ws-content" aria-label={title}>
      <div className="ws-content-scroll">
        <div className="ws-content-inner">
          <p className="ws-content-eyebrow">{identity.name}</p>
          <h4 className="ws-content-title">{title}</h4>
          <p className="ws-content-desc">{desc}</p>
          <div className="ws-content-body">{body}</div>
        </div>
      </div>
    </section>
  )
}
