import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import type { CardSummary, CardView } from './card-view'
import CardHead from './CardHead'
import CentreVisuals from './CentreVisuals'
import CentreContent from './CentreContent'
import { GuideDetailBody, DetailBody } from './guide-content'
import {
  DETAIL_CARDS,
  GUIDE_SECTIONS,
  buildInsightThread,
  detailMeta,
  guideComplete,
  guideHint,
  type DetailKey,
  type GuideSectionNumber
} from './guide-model'

export type WorkspaceTab = 'chat' | 'guide' | 'summary' | 'files'

interface ExpandedWorkspaceProps {
  view: CardView
  summary: CardSummary
  syncing: boolean
  onSync: () => void
  onSettings: () => void
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  /** Optional: open a specific guide section on mount (from compact chip). */
  initialGuideSection?: number
  /** Optional: open a right-rail detail card on mount. */
  initialDetailKey?: DetailKey
}

function formatMsgTime(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
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
  const { identity, leftSidebar, centre, rightSidebar, aiBadge } = view
  const [tab, setTab] = useState<WorkspaceTab>(
    initialDetailKey || initialGuideSection ? 'guide' : 'chat'
  )
  const [guideSection, setGuideSection] = useState<GuideSectionNumber>(
    (initialGuideSection && initialGuideSection >= 1 && initialGuideSection <= 7
      ? initialGuideSection
      : 1) as GuideSectionNumber
  )
  const [detailKey, setDetailKey] = useState<DetailKey | null>(initialDetailKey ?? null)
  const [draft, setDraft] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)

  const thread = useMemo(() => buildInsightThread(centre, identity.name), [centre, identity.name])

  const selectGuide = (n: GuideSectionNumber): void => {
    setGuideSection(n)
    setDetailKey(null)
    setTab('guide')
  }

  const selectDetail = (key: DetailKey): void => {
    setDetailKey(key)
    setTab('guide')
  }

  const goPrev = (): void => {
    if (detailKey) {
      setDetailKey(null)
      return
    }
    const prev = (guideSection <= 1 ? 7 : guideSection - 1) as GuideSectionNumber
    selectGuide(prev)
  }

  const goNext = (): void => {
    if (detailKey) {
      setDetailKey(null)
      return
    }
    const next = (guideSection >= 7 ? 1 : guideSection + 1) as GuideSectionNumber
    selectGuide(next)
  }

  const centreTitle = detailKey
    ? (DETAIL_CARDS.find((c) => c.key === detailKey)?.title ?? 'Detail')
    : `${GUIDE_SECTIONS[guideSection - 1].title} #${guideSection}`

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
        aiBadge={aiBadge}
        syncing={syncing}
        onSync={onSync}
        onSettings={onSettings}
        onEdit={onEdit}
        onRemove={onRemove}
        onToggle={onToggle}
        expanded
      />

      <div className="ws-tabs" role="tablist" aria-label="Workspace views">
        {(
          [
            ['chat', 'Chat'],
            ['guide', 'Project Guide'],
            ['summary', 'Summary'],
            ['files', 'Files']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`ws-tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => {
              setTab(id)
              if (id !== 'guide') setDetailKey(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ws-body">
        {/* LEFT — Project Guide nav */}
        <aside className="ws-panel ws-guide" aria-label="Project Guide">
          <header className="ws-panel-head">
            <h4>Project Guide</h4>
          </header>
          <nav className="ws-guide-nav" aria-label="Guide sections">
            {GUIDE_SECTIONS.map((s) => {
              const active =
                !detailKey && tab !== 'files' && tab !== 'summary' && guideSection === s.number
              const done = guideComplete(leftSidebar, s.number)
              return (
                <button
                  key={s.number}
                  type="button"
                  className={`ws-guide-item ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => selectGuide(s.number)}
                >
                  <span className={`ws-guide-num ${done ? 'is-done' : ''}`}>
                    {done ? '✓' : s.number}
                  </span>
                  <span className="ws-guide-text">
                    <span className="ws-guide-title">{s.title}</span>
                    <span className="ws-guide-hint">{guideHint(leftSidebar, s.number)}</span>
                  </span>
                  <span className="ws-guide-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* CENTER */}
        <section className="ws-panel ws-center" aria-label="Workspace content">
          {tab === 'chat' ? (
            <>
              <header className="ws-center-head">
                <div className="ws-center-nav">
                  <button
                    type="button"
                    className="ws-icon-nav"
                    onClick={goPrev}
                    aria-label="Previous section"
                  >
                    ‹
                  </button>
                  <h4>Chat · {identity.name}</h4>
                  <button
                    type="button"
                    className="ws-icon-nav"
                    onClick={goNext}
                    aria-label="Next section"
                  >
                    ›
                  </button>
                </div>
              </header>
              <div className="ws-chat-scroll" role="log" aria-live="polite">
                {thread.length === 0 ? (
                  <p className="ws-empty">
                    No chat evidence yet — sync this project to pull Slack messages into the
                    insight.
                  </p>
                ) : (
                  thread.map((m) => (
                    <div
                      key={m.id}
                      className={`ws-bubble ${m.side === 'client' ? 'is-client' : 'is-orbit'}`}
                    >
                      <div className="ws-bubble-meta">
                        <strong>{m.who}</strong>
                        {m.whenIso ? <span>{formatMsgTime(m.whenIso)}</span> : null}
                      </div>
                      <p>{m.body}</p>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
              <form
                className="ws-composer"
                onSubmit={(e) => {
                  e.preventDefault()
                  // Sending lives in the Slack embed — composer is a visual anchor only.
                }}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message… (reply in Slack)"
                  aria-label="Message draft"
                  disabled
                />
                <div className="ws-composer-actions">
                  <span className="ws-composer-hint">
                    Replies go through the Slack workspace view
                  </span>
                  <button type="submit" className="ws-send" disabled title="Open Slack to send">
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {tab === 'guide' ? (
            <>
              <header className="ws-center-head">
                <div className="ws-center-nav">
                  <button
                    type="button"
                    className="ws-icon-nav"
                    onClick={goPrev}
                    aria-label="Previous section"
                  >
                    ‹
                  </button>
                  <h4>{centreTitle}</h4>
                  <button
                    type="button"
                    className="ws-icon-nav"
                    onClick={goNext}
                    aria-label="Next section"
                  >
                    ›
                  </button>
                </div>
              </header>
              <div className="ws-center-scroll">
                {detailKey ? (
                  <DetailBody data={rightSidebar} detailKey={detailKey} />
                ) : (
                  <GuideDetailBody data={leftSidebar} section={guideSection} />
                )}
              </div>
            </>
          ) : null}

          {tab === 'summary' ? (
            <div className="ws-center-scroll ws-summary-stack">
              <CentreVisuals visuals={centre.visuals} />
              <CentreContent centre={centre} />
            </div>
          ) : null}

          {tab === 'files' ? (
            <>
              <header className="ws-center-head">
                <h4>Files & Links</h4>
              </header>
              <div className="ws-center-scroll">
                <GuideDetailBody data={leftSidebar} section={6} />
              </div>
            </>
          ) : null}
        </section>

        {/* RIGHT — Project Details */}
        <aside className="ws-panel ws-details" aria-label="Project Details">
          <header className="ws-panel-head">
            <h4>Project Details</h4>
          </header>
          <div className="ws-details-scroll">
            {DETAIL_CARDS.map((card) => {
              const meta = detailMeta(rightSidebar, card.key)
              const active = detailKey === card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`ws-detail-card tone-${card.tone} ${active ? 'is-active' : ''}`}
                  onClick={() => selectDetail(card.key)}
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
        </aside>
      </div>
    </article>
  )
}
