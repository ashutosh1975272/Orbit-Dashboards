import type React from 'react'
import type { CardView, CardSummary } from './card-view'
import type {
  DashboardProject,
  DashboardProjectSnapshot
} from '../../../../shared/dashboard-contract'
import CentreContent from './CentreContent'
import CentreVisuals from './CentreVisuals'
import DashboardPage from './DashboardPage'
import NavIcon from './nav-icons'
import { DetailBody, GuideDetailBody } from './guide-content'
import SlackChatTab from './SlackChatTab'
import CardLiveSlackEmbed from './CardLiveSlackEmbed'
import ProjectSettingsTab from './ProjectSettingsTab'
import AgentChatPanel from './AgentChatPanel'
import { requestMessageJump } from './jump-to-message'
import SchedulesPage from './SchedulesPage'
import { AppIcon } from '../AppIcon'
import {
  channelIdOf,
  connectorOf,
  connectorOfSelection,
  detailKeyOf,
  guideSectionOf,
  isChannelId,
  isDetailId,
  isGlobalWorkspaceId,
  isGuideId,
  isVisualId,
  navRowOf,
  slackSourceOf,
  visualKeyOf,
  xomniModeOf,
  type ConnectorChannelLists,
  type OpenGroup,
  type SelectionId,
  type WorkspaceNavState
} from './workspace-nav'

interface WorkspaceContentProps {
  view: CardView
  summary: CardSummary
  project: DashboardProject
  snapshot: DashboardProjectSnapshot
  nav: WorkspaceNavState
  channels: ConnectorChannelLists
  syncing: boolean
  onSync: () => void
  onOpenSettings: () => void
  onSelect: (selection: SelectionId) => void
  /** Dashboard overview → chat hand-off. */
  chatDraft?: string | null
  onConsumeChatDraft?: () => void
}

/** Headings for the bodies no row owns. */
const GROUP_META: Record<OpenGroup, { title: string; desc: string }> = {
  dash: { title: 'Dashboard', desc: 'Everything about this project at a glance.' },
  xomni: { title: 'Xomni', desc: 'Chat with this project.' },
  slack: {
    title: 'Connect channel',
    desc: 'Messages from Our Slack and the client’s Slack workspace.'
  },
  info: { title: 'Project info', desc: 'What this card has learned about the project.' },
  viz: { title: 'Visualizations', desc: 'Charts built from this project’s own numbers.' },
  settings: { title: 'Settings', desc: 'Model, key, channels and dates for this card.' }
}

function panelMeta(
  nav: WorkspaceNavState,
  channels: ConnectorChannelLists
): { title: string; desc: string } {
  const sel = nav.selection
  if (sel && isChannelId(sel)) {
    const key = connectorOfSelection(sel)
    const connector = connectorOf(key)
    const id = channelIdOf(sel)
    const entry = channels[key ?? 'client']?.entries.find((ch) => ch.id === id)
    return {
      title: entry ? `#${entry.name}` : (connector?.label ?? 'Channels'),
      desc: 'One channel from this connector. Replies post here.'
    }
  }
  // A connector's whole-workspace row is named "All channels" in the dropdown,
  // which only reads clearly next to the connector's own label.
  if (sel && sel.startsWith('s:')) {
    const connector = connectorOf(connectorOfSelection(sel))
    if (connector) return { title: `All of ${connector.label}`, desc: connector.note }
  }
  const row = navRowOf(nav.selection)
  if (row) return { title: row.label, desc: row.desc }
  return GROUP_META[nav.openGroup]
}

export default function WorkspaceContent({
  view,
  summary,
  project,
  snapshot,
  nav,
  channels,
  syncing,
  onSync,
  onOpenSettings,
  onSelect,
  chatDraft,
  onConsumeChatDraft
}: WorkspaceContentProps): React.ReactElement {
  const { centre, leftSidebar, rightSidebar, identity } = view
  const { title, desc } = panelMeta(nav, channels)
  const sel = nav.selection

  // Dashboard brings its own scroll surface and width; the generic panel header
  // would repeat the project name above the freshness line.
  if (nav.openGroup === 'dash') {
    return (
      <section className="ws-content is-bare" aria-label="Dashboard">
        <DashboardPage
          view={view}
          summary={summary}
          project={project}
          snapshot={snapshot}
          syncing={syncing}
          onSync={onSync}
          onOpenSettings={onOpenSettings}
          onSelect={onSelect}
        />
      </section>
    )
  }

  let body: React.ReactNode
  let bare = false

  if (nav.openGroup === 'xomni') {
    if (xomniModeOf(nav) === 'schedules') {
      body = <SchedulesPage />
    } else {
      body = (
        <AgentChatPanel
          key={summary.projectId}
          projectName={identity.name}
          projectId={summary.projectId}
          mode={xomniModeOf(nav)}
          initialQuestion={chatDraft}
          onConsumeInitial={onConsumeChatDraft}
          onOpenSettings={onOpenSettings}
          onOpenSource={(ref) => {
            // Always navigate to the channel; the Slack tab consumes this
            // target and scrolls/flashes when the message is loaded.
            requestMessageJump({
              projectId: summary.projectId,
              source: ref.source,
              channelId: ref.channelId,
              ts: ref.ts
            })
            onSelect(
              `c:${ref.source === 'ours' ? 'team' : 'client'}:${ref.channelId}` as SelectionId
            )
          }}
        />
      )
      bare = true
    }
  } else if (nav.openGroup === 'slack') {
    if (sel && isGlobalWorkspaceId(sel)) {
      // Global workspace selected: mount real live Slack WebContentsView inside this card
      const [, pId, tId] = sel.split(':')
      body = (
        <CardLiveSlackEmbed
          key={`global-embed:${pId}:${tId}`}
          profileId={pId}
          teamId={tId}
        />
      )
    } else if (sel && sel.startsWith('c:teams')) {
      body = (
        <div className="ws-agent">
          <div className="ws-agent-empty">
            <span className="ws-agent-empty-icon" style={{ display: 'inline-flex', padding: 8 }}>
              <AppIcon appId="teams" size={36} />
            </span>
            <p className="ws-agent-empty-title">Microsoft Teams</p>
            <p className="ws-agent-empty-hint">
              Microsoft Teams integration for this card. Connect or open Teams from the app sidebar or profiles hub.
            </p>
          </div>
        </div>
      )
    } else if (sel && sel.startsWith('c:whatsapp')) {
      body = (
        <div className="ws-agent">
          <div className="ws-agent-empty">
            <span className="ws-agent-empty-icon" style={{ display: 'inline-flex', padding: 8 }}>
              <AppIcon appId="whatsapp" size={36} />
            </span>
            <p className="ws-agent-empty-title">WhatsApp</p>
            <p className="ws-agent-empty-hint">
              WhatsApp integration for this card. Connect or open WhatsApp from the app sidebar or profiles hub.
            </p>
          </div>
        </div>
      )
    } else if (slackSourceOf(nav) === 'team' && !channels.teamConnected) {
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
      const source = slackSourceOf(nav) === 'team' ? 'ours' : 'client'
      const listed = channels[connectorOfSelection(sel) === 'team' ? 'team' : 'client']
      body = (
        <SlackChatTab
          key={`${source}:${sel ?? 'all'}`}
          projectId={summary.projectId}
          source={source}
          lockedChannel={
            sel && isChannelId(sel)
              ? (() => {
                  const id = channelIdOf(sel)
                  const entry = listed?.entries.find((ch) => ch.id === id)
                  const watched = identity.channels.find((c) => c.channelId === id)
                  return { id, name: entry?.name ?? watched?.channelName ?? id }
                })()
              : null
          }
        />
      )
    }
    bare = true
  } else if (nav.openGroup === 'settings') {
    body = <ProjectSettingsTab project={project} />
    bare = true
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
          Pick a row under Project info — needs reply, blockers, requirements, history — to see what
          this card has learned.
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
