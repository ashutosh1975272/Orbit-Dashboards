import type React from 'react'
import { useState } from 'react'
import type { CardSummary, CardView } from './card-view'
import CardHead from './CardHead'
import CentreVisuals from './CentreVisuals'
import CentreContent from './CentreContent'
import { DetailBody, GuideDetailBody } from './guide-content'
import { DETAIL_CARDS, detailMeta, type DetailKey } from './guide-model'
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse'
import SlackChatTab from './SlackChatTab'
import AiChatTab from './AiChatTab'
import ProjectSettingsTab from './ProjectSettingsTab'

export type WorkspaceTab =
  | 'summary'
  | 'slack-chat'
  | 'ai-chat'
  | 'requirements'
  | 'scope'
  | 'decisions'
  | 'commitments'
  | 'files'
  | 'people'
  | 'settings'

interface ExpandedWorkspaceProps {
  view: CardView
  summary: CardSummary
  syncing: boolean
  onSync: () => void
  onSettings: () => void
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  /** Optional: open a data tab on mount (from a compact chip). */
  initialGuideSection?: number
  /** Optional: open a detail card inside Summary on mount. */
  initialDetailKey?: DetailKey
}

interface TabDef {
  id: WorkspaceTab
  label: string
  /** Guide section body rendered full-width (data tabs only). */
  section?: 2 | 3 | 4 | 5 | 6 | 7
  /** Count badge; zero renders dimmed. */
  badge?: number
  /** Settings tab: pinned right with distinct styling. */
  settings?: boolean
}

/** Map the old guide-section / compact-chip entry points onto the new tab set. */
function initialTabFor(initialGuideSection?: number, initialDetailKey?: DetailKey): WorkspaceTab {
  if (initialDetailKey) return 'summary'
  switch (initialGuideSection) {
    case 2:
      return 'requirements'
    case 3:
      return 'scope'
    case 4:
      return 'decisions'
    case 5:
      return 'commitments'
    case 6:
      return 'files'
    case 7:
      return 'people'
    default:
      return 'summary'
  }
}

/** Full-width panel shell shared by every non-Summary tab. */
function tabPanel(title: string, body: React.ReactNode, badge?: number): React.ReactElement {
  return (
    <section className="ws-tab-panel">
      <header className="ws-tab-panel-head">
        <h4>{title}</h4>
        {badge !== undefined && (
          <span className={`ws-tab-badge${badge === 0 ? ' is-zero' : ''}`}>{badge}</span>
        )}
      </header>
      <div className="ws-tab-panel-body">{body}</div>
    </section>
  )
}

export default function ExpandedWorkspace({
  view,
  summary,
  syncing,
  onSync,
  onSettings,
  onEdit,
  onRemove,
  onToggle,
  initialGuideSection,
  initialDetailKey
}: ExpandedWorkspaceProps): React.ReactElement {
  const { identity, leftSidebar, centre, rightSidebar } = view
  const [tab, setTab] = useState<WorkspaceTab>(() =>
    initialTabFor(initialGuideSection, initialDetailKey)
  )
  const [summaryDetail, setSummaryDetail] = useState<DetailKey | null>(initialDetailKey ?? null)
  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useSidebarCollapse(
    summary.projectId
  )

  const tabs: TabDef[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'slack-chat', label: 'Slack Chat' },
    { id: 'ai-chat', label: identity.name },
    {
      id: 'requirements',
      label: 'Project Requirements',
      section: 2,
      badge: leftSidebar.requirements.length
    },
    { id: 'scope', label: 'Scope & Deliverables', section: 3 },
    { id: 'decisions', label: 'Decisions', section: 4, badge: leftSidebar.decisions.length },
    { id: 'commitments', label: 'Commitments', section: 5, badge: leftSidebar.commitments.length },
    { id: 'files', label: 'Files & Links', section: 6, badge: leftSidebar.files.length },
    {
      id: 'people',
      label: 'People & Channels',
      section: 7,
      badge: leftSidebar.peopleChannels.people.length
    },
    { id: 'settings', label: 'Settings', settings: true }
  ]

  const selectTab = (id: WorkspaceTab): void => {
    setTab(id)
    if (id !== 'summary') setSummaryDetail(null)
  }

  const detailTitle = summaryDetail
    ? (DETAIL_CARDS.find((c) => c.key === summaryDetail)?.title ?? 'Detail')
    : ''
  const activeDataTab = tabs.find((t) => t.id === tab && t.section !== undefined)
  const activeSection = activeDataTab?.section
  const summaryClasses = [
    'ws-summary',
    leftCollapsed ? 'is-left-collapsed' : '',
    rightCollapsed ? 'is-right-collapsed' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className="ws-shell"
      id={`dash-card-anchor-${summary.projectId}`}
      data-testid={`dash-card-${summary.index}`}
      data-expanded="true"
    >
      <div className="ws-crumb">
        <span>Workspaces</span>
        <span className="ws-crumb-sep">›</span>
        <span className="ws-crumb-current">{identity.name}</span>
      </div>

      <div className="ws-status-row" role="list" aria-label="Project status filters">
        <span
          className={`ws-status-pill ${summary.status === 'on-track' ? 'is-on' : ''}`}
          role="listitem"
        >
          Active
        </span>
        <span
          className={`ws-status-pill is-wait ${summary.status === 'waiting-on-client' ? 'is-on' : ''}`}
          role="listitem"
        >
          Waiting on client
        </span>
        <span
          className={`ws-status-pill is-reply ${summary.needsReply ? 'is-on' : ''}`}
          role="listitem"
        >
          Needs my reply
        </span>
        <span
          className={`ws-status-pill is-idle ${summary.inactive ? 'is-on' : ''}`}
          role="listitem"
        >
          Inactive 24h+
        </span>
      </div>

      <CardHead
        index={summary.index}
        name={identity.name}
        workspaceName={identity.teamName}
        clientName={identity.clientName}
        status={centre.status}
        needsReply={summary.needsReply}
        inactive={summary.inactive}
        aiBadge={view.aiBadge}
        syncing={syncing}
        onSync={onSync}
        onSettings={onSettings}
        onEdit={onEdit}
        onRemove={onRemove}
        onToggle={onToggle}
        expanded
      />

      <div className="ws-tabs" role="tablist" aria-label="Workspace views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ws-tab${tab === t.id ? ' is-active' : ''}${t.settings ? ' is-settings' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span className={`ws-tab-badge${t.badge === 0 ? ' is-zero' : ''}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        <div className={summaryClasses}>
          {/* LEFT — visuals */}
          <aside
            className={`ws-panel ws-summary-left${leftCollapsed ? ' is-collapsed' : ''}`}
            aria-label="Overview"
          >
            <header className="ws-panel-head">
              {!leftCollapsed && <h4>Overview</h4>}
              <button
                type="button"
                className="ws-rail-toggle"
                onClick={toggleLeft}
                aria-label={leftCollapsed ? 'Expand overview sidebar' : 'Collapse overview sidebar'}
                aria-expanded={!leftCollapsed}
              >
                {leftCollapsed ? '›' : '‹'}
              </button>
            </header>
            {!leftCollapsed && (
              <div className="ws-summary-side-scroll">
                <CentreVisuals visuals={centre.visuals} />
              </div>
            )}
          </aside>

          {/* CENTRE — summary, or one detail card opened from the right rail */}
          <section className="ws-panel ws-center ws-summary-centre" aria-label="Summary">
            {summaryDetail ? (
              <>
                <header className="ws-center-head">
                  <div className="ws-center-nav">
                    <button
                      type="button"
                      className="ws-icon-nav"
                      onClick={() => setSummaryDetail(null)}
                      aria-label="Back to summary"
                    >
                      ‹
                    </button>
                    <h4>{detailTitle}</h4>
                    <span className="ws-nav-spacer" aria-hidden="true" />
                  </div>
                </header>
                <div className="ws-center-scroll">
                  <DetailBody data={rightSidebar} detailKey={summaryDetail} />
                </div>
              </>
            ) : (
              <div className="ws-center-scroll ws-summary-stack">
                <CentreContent centre={centre} />
              </div>
            )}
          </section>

          {/* RIGHT — Project Details cards */}
          <aside
            className={`ws-panel ws-summary-right${rightCollapsed ? ' is-collapsed' : ''}`}
            aria-label="Project Details"
          >
            <header className="ws-panel-head">
              {!rightCollapsed && <h4>Project Details</h4>}
              <button
                type="button"
                className="ws-rail-toggle"
                onClick={toggleRight}
                aria-label={
                  rightCollapsed
                    ? 'Expand project details sidebar'
                    : 'Collapse project details sidebar'
                }
                aria-expanded={!rightCollapsed}
              >
                {rightCollapsed ? '‹' : '›'}
              </button>
            </header>
            {!rightCollapsed && (
              <div className="ws-details-scroll">
                {DETAIL_CARDS.map((card) => {
                  const meta = detailMeta(rightSidebar, card.key)
                  const active = summaryDetail === card.key
                  return (
                    <button
                      key={card.key}
                      type="button"
                      className={`ws-detail-card tone-${card.tone} ${active ? 'is-active' : ''}`}
                      onClick={() => setSummaryDetail(card.key)}
                      aria-pressed={active}
                    >
                      <div className="ws-detail-card-top">
                        <span className="ws-detail-card-title">{card.title}</span>
                        <span className={`ws-detail-badge tone-${card.tone}`}>{meta.count}</span>
                      </div>
                      <p className="ws-detail-card-summary">{meta.summary}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === 'slack-chat'
        ? tabPanel('Slack Chat', <SlackChatTab projectName={identity.name} />)
        : null}
      {tab === 'ai-chat'
        ? tabPanel(identity.name, <AiChatTab projectName={identity.name} />)
        : null}
      {tab === 'settings'
        ? tabPanel('Settings', <ProjectSettingsTab projectName={identity.name} />)
        : null}
      {activeSection
        ? tabPanel(
            activeDataTab?.label ?? '',
            <GuideDetailBody data={leftSidebar} section={activeSection} />,
            activeDataTab?.badge
          )
        : null}
    </article>
  )
}
