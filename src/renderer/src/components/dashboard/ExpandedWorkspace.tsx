import type React from 'react'
import { useState } from 'react'
import type { DashboardProject } from '../../../../shared/dashboard-contract'
import type { CardSummary, CardView } from './card-view'
import CardHead, { type CardHeadFlag } from './CardHead'
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
  project: DashboardProject
  syncing: boolean
  onSync: () => void
  onSettings: () => void
  onRemove: () => void
  onToggle: () => void
  /** Force a starting tab (the card-header gear opens Settings). */
  initialTab?: WorkspaceTab
  /** Optional: open a data tab on mount (from a compact chip). */
  initialGuideSection?: number
  /** Optional: open a detail card inside Summary on mount. */
  initialDetailKey?: DetailKey
}

interface TabDef {
  id: WorkspaceTab
  /** Short label used in the tab strip. */
  label: string
  /** Full title used for the panel heading, when longer than the tab label. */
  panel?: string
  /** Guide section body rendered full-width (data tabs only). */
  section?: 2 | 3 | 4 | 5 | 6 | 7
  /** Count badge; zero is not rendered. */
  badge?: number
  /** Settings tab: icon button pinned to the right. */
  settings?: boolean
}

function GearGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  )
}

const STATUS_FLAGS: Record<string, CardHeadFlag> = {
  'on-track': { label: 'On track', tone: 'success' },
  'at-risk': { label: 'At risk', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'danger' },
  'waiting-on-client': { label: 'Waiting on client', tone: 'warn' }
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
function tabPanel(
  title: string,
  body: React.ReactNode,
  badge?: number,
  bodyClassName?: string
): React.ReactElement {
  return (
    <section className="ws-tab-panel">
      <header className="ws-tab-panel-head">
        <h4>{title}</h4>
        {badge !== undefined && (
          <span className={`ws-tab-badge${badge === 0 ? ' is-zero' : ''}`}>{badge}</span>
        )}
      </header>
      <div className={`ws-tab-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{body}</div>
    </section>
  )
}

export default function ExpandedWorkspace({
  view,
  summary,
  project,
  syncing,
  onSync,
  onSettings,
  onRemove,
  onToggle,
  initialTab,
  initialGuideSection,
  initialDetailKey
}: ExpandedWorkspaceProps): React.ReactElement {
  const { identity, leftSidebar, centre, rightSidebar } = view
  const [tab, setTab] = useState<WorkspaceTab>(
    () => initialTab ?? initialTabFor(initialGuideSection, initialDetailKey)
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
      label: 'Requirements',
      panel: 'Project Requirements',
      section: 2,
      badge: leftSidebar.requirements.length
    },
    { id: 'scope', label: 'Scope', panel: 'Scope & Deliverables', section: 3 },
    { id: 'decisions', label: 'Decisions', section: 4, badge: leftSidebar.decisions.length },
    { id: 'commitments', label: 'Commitments', section: 5, badge: leftSidebar.commitments.length },
    { id: 'files', label: 'Files', panel: 'Files & Links', section: 6, badge: leftSidebar.files.length },
    {
      id: 'people',
      label: 'People',
      panel: 'People & Channels',
      section: 7,
      badge: leftSidebar.peopleChannels.people.length
    },
    { id: 'settings', label: 'Settings', settings: true }
  ]

  const selectTab = (id: WorkspaceTab): void => {
    setTab(id)
    if (id !== 'summary') setSummaryDetail(null)
  }

  const statusFlag: CardHeadFlag | null = summary.status
    ? (STATUS_FLAGS[summary.status] ?? { label: summary.status, tone: 'muted' })
    : null

  const headFlags: CardHeadFlag[] = [
    ...(statusFlag ? [statusFlag] : []),
    ...(summary.needsReply ? [{ label: 'Needs my reply', tone: 'danger' as const }] : []),
    ...(summary.inactive ? [{ label: 'Inactive 24h+', tone: 'muted' as const }] : [])
  ]

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
      <CardHead
        name={identity.name}
        workspaceName={identity.teamName}
        clientName={identity.clientName}
        aiBadge={view.aiBadge}
        flags={headFlags}
        syncing={syncing}
        onSync={onSync}
        onSettings={onSettings}
        onRemove={onRemove}
        onToggle={onToggle}
      />

      <div className="ws-tabs" role="tablist" aria-label="Workspace views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.settings ? 'Settings' : undefined}
            title={t.settings ? 'Settings' : undefined}
            className={`ws-tab${tab === t.id ? ' is-active' : ''}${t.settings ? ' is-settings' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            {t.settings ? <GearGlyph /> : <span>{t.label}</span>}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ws-tab-badge">{t.badge}</span>
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
                        <span
                          className={`ws-detail-badge tone-${card.tone}${meta.count === 0 ? ' is-zero' : ''}`}
                        >
                          {meta.count}
                        </span>
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
        ? tabPanel(
            'Slack Chat',
            <SlackChatTab
              projectId={summary.projectId}
              channels={identity.channels.map((channel) => ({
                channelId: channel.channelId,
                channelName: channel.channelName
              }))}
            />,
            undefined,
            'is-chat'
          )
        : null}
      {tab === 'ai-chat'
        ? tabPanel(identity.name, <AiChatTab projectName={identity.name} />)
        : null}
      {tab === 'settings' ? tabPanel('Settings', <ProjectSettingsTab project={project} />) : null}
      {activeSection
        ? tabPanel(
            activeDataTab?.panel ?? activeDataTab?.label ?? '',
            <GuideDetailBody data={leftSidebar} section={activeSection} />,
            activeDataTab?.badge
          )
        : null}
    </article>
  )
}
