import type React from 'react'
import { Fragment, useRef } from 'react'
import type { CardView } from './card-view'
import NavIcon from './nav-icons'
import { detailMeta } from './guide-model'
import {
  INFO_GROUPS,
  NAV_CONNECTORS,
  NAV_SECTIONS,
  NAV_WIDTH_DEFAULT,
  NAV_WIDTH_MAX,
  NAV_WIDTH_MIN,
  channelSelectionId,
  clampNavWidth,
  connectorOfSelection,
  detailKeyOf,
  guideSectionOf,
  isDetailId,
  isGuideId,
  railSectionSelection,
  sectionOfSelection,
  type ConnectorChannelLists,
  type ConnectorKey,
  type InfoGroupKey,
  type NavRow,
  type OpenGroup,
  type SectionKey,
  type SelectionId,
  type WorkspaceNavState
} from './workspace-nav'

interface WorkspaceSidebarProps {
  view: CardView
  nav: WorkspaceNavState
  channels: ConnectorChannelLists
  onOpenGroup: (group: OpenGroup) => void
  onSelect: (selection: SelectionId) => void
  onToggleSection: (key: SectionKey) => void
  onToggleInfoGroup: (key: InfoGroupKey) => void
  onToggleConnector: (key: ConnectorKey) => void
  onToggleCollapse: () => void
  onResize: (width: number) => void
}

/** Real counts only — a row with nothing in it is dimmed, never given a badge. */
function rowCount(view: CardView, id: SelectionId): number | undefined {
  if (isDetailId(id)) return detailMeta(view.rightSidebar, detailKeyOf(id)).count
  if (!isGuideId(id)) return undefined
  const l = view.leftSidebar
  switch (guideSectionOf(id)) {
    case 2:
      return l.requirements.length
    case 3:
      return (
        l.scopeDeliverables.inScope.length +
        l.scopeDeliverables.outOfScope.length +
        l.scopeDeliverables.deliverables.length
      )
    case 4:
      return l.decisions.length
    case 5:
      return l.commitments.length
    case 6:
      return l.files.length
    case 7:
      return l.peopleChannels.people.length
    default:
      return undefined
  }
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      className={`ws-nav-chevron${open ? ' is-open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  )
}

interface RowProps {
  label: string
  active: boolean
  onClick: () => void
  icon?: string
  count?: number
  disabled?: boolean
  title?: string
  railOnly?: boolean
  /** Dashboard and Settings live in both the rail and the expanded panel. */
  fixed?: boolean
  leaf?: boolean
  /** A short real-state word after the label — 'synced', never a count. */
  tag?: string
}

/** One selectable line: a top-level row with an icon, or a leaf under a
 * Project info sub-group (no icon, indented). */
function Row({
  label,
  active,
  onClick,
  icon,
  count,
  disabled,
  title,
  railOnly,
  fixed,
  leaf,
  tag
}: RowProps): React.JSX.Element {
  const cls = [
    leaf ? 'ws-nav-subitem' : 'ws-nav-item',
    active ? ' is-active' : '',
    count === 0 ? ' is-empty' : '',
    railOnly ? ' ws-nav-railonly' : '',
    fixed ? ' ws-nav-fixed' : ''
  ].join('')
  return (
    <button
      type="button"
      className={cls}
      aria-disabled={disabled || undefined}
      title={title ?? label}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      onClick={disabled ? undefined : onClick}
    >
      {icon && (
        <span className="ws-nav-icon">
          <NavIcon name={icon} />
        </span>
      )}
      <span className="ws-nav-label">{label}</span>
      {tag && <span className="ws-nav-tag">{tag}</span>}
      {typeof count === 'number' && <span className="ws-nav-count">{count}</span>}
    </button>
  )
}

export default function WorkspaceSidebar({
  view,
  nav,
  channels,
  onOpenGroup,
  onSelect,
  onToggleSection,
  onToggleInfoGroup,
  onToggleConnector,
  onToggleCollapse,
  onResize
}: WorkspaceSidebarProps): React.ReactElement {
  const collapsed = nav.collapsed
  const asideRef = useRef<HTMLElement>(null)

  const rowActive = (row: NavRow): boolean =>
    nav.openGroup === sectionOfSelection(row.id) && nav.selection === row.id

  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const handle = event.currentTarget
    const body = asideRef.current?.closest('.ws-body') as HTMLElement | null
    const startX = event.clientX
    const startW = nav.width
    let latest = startW
    handle.classList.add('is-dragging')
    document.body.classList.add('is-resizing-nav')
    handle.setPointerCapture(event.pointerId)

    const onMove = (ev: PointerEvent): void => {
      latest = clampNavWidth(startW + (ev.clientX - startX))
      body?.style.setProperty('--ws-nav-w', `${latest}px`)
    }
    const onUp = (ev: PointerEvent): void => {
      handle.releasePointerCapture(ev.pointerId)
      handle.classList.remove('is-dragging')
      document.body.classList.remove('is-resizing-nav')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      onResize(latest)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onResizeKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 32 : 12
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onResize(clampNavWidth(nav.width - step))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onResize(clampNavWidth(nav.width + step))
    }
  }

  return (
    <aside
      ref={asideRef}
      className={`ws-nav${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Workspace navigation"
    >
      <div className="ws-nav-collapse">
        <button
          type="button"
          className="ws-nav-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span aria-hidden>{collapsed ? '»' : '«'}</span>
        </button>
      </div>

      <nav className="ws-nav-list">
        <Row
          fixed
          icon="dashboard"
          label="Dashboard"
          title="Dashboard"
          active={nav.openGroup === 'dash'}
          onClick={() => onOpenGroup('dash')}
        />

        {NAV_SECTIONS.map((section) => {
          const sectionOpen = nav.openSections.includes(section.key)
          const rail = railSectionSelection(nav, section.key)
          // A closed section that owns what the centre shows keeps the accent
          // marker, so the active body always has a visible home.
          const holding = !sectionOpen && nav.openGroup === section.key
          return (
            <Fragment key={section.key}>
              {/* Collapsed rail: the whole section is one icon that restores
                  its last picked row. Hidden while expanded. */}
              <Row
                railOnly
                icon={section.icon}
                label={section.label}
                title={section.label}
                active={nav.openGroup === section.key}
                onClick={() => {
                  if (rail) onSelect(rail)
                  else onOpenGroup(section.key)
                }}
              />

              <button
                type="button"
                className={`ws-nav-section${sectionOpen ? ' is-open' : ''}${holding ? ' is-holding' : ''}`}
                aria-expanded={sectionOpen}
                onClick={() => onToggleSection(section.key)}
              >
                <span className="ws-nav-label">{section.label}</span>
                <Chevron open={sectionOpen} />
              </button>

              {sectionOpen &&
                (section.key === 'info' ? (
                  INFO_GROUPS.map((group) => {
                    const groupOpen = nav.openInfoGroups.includes(group.key)
                    const groupRows = section.rows.filter((row) => row.group === group.key)
                    const groupHolding = !groupOpen && groupRows.some((row) => rowActive(row))
                    return (
                      <div key={group.key} className="ws-nav-group">
                        <button
                          type="button"
                          className={`ws-nav-groupbtn${groupOpen ? ' is-open' : ''}${
                            groupHolding ? ' is-holding' : ''
                          }`}
                          aria-expanded={groupOpen}
                          onClick={() => onToggleInfoGroup(group.key)}
                        >
                          <span className="ws-nav-icon">
                            <NavIcon name={group.icon} />
                          </span>
                          <span className="ws-nav-label">{group.label}</span>
                          <Chevron open={groupOpen} />
                        </button>
                        {groupOpen &&
                          groupRows.map((row) => (
                            <Row
                              key={row.id}
                              leaf
                              label={row.label}
                              count={rowCount(view, row.id)}
                              active={rowActive(row)}
                              onClick={() => onSelect(row.id)}
                            />
                          ))}
                      </div>
                    )
                  })
                ) : section.key === 'slack' ? (
                  NAV_CONNECTORS.map((connector) => {
                    const list = channels[connector.key]
                    const allId = connector.allId
                    const entries = list?.entries ?? []
                    const open = nav.openConnectors.includes(connector.key)
                    const holding =
                      !open && connectorOfSelection(nav.selection) === connector.key
                    return (
                      <div key={connector.key} className="ws-nav-group">
                        <button
                          type="button"
                          className={`ws-nav-groupbtn ws-nav-connector${open ? ' is-open' : ''}${
                            holding ? ' is-holding' : ''
                          }`}
                          aria-expanded={open}
                          title={connector.note}
                          onClick={() => onToggleConnector(connector.key)}
                        >
                          <span className="ws-nav-icon">
                            <NavIcon name={connector.icon} />
                          </span>
                          <span className="ws-nav-label">{connector.label}</span>
                          {entries.length > 0 && (
                            <span className="ws-nav-count">{entries.length}</span>
                          )}
                          <Chevron open={open} />
                        </button>
                        {open && (
                          <>
                            {allId && (
                              <Row
                                leaf
                                label="All channels"
                                title={connector.note}
                                active={nav.selection === allId}
                                onClick={() => onSelect(allId)}
                              />
                            )}
                            {list?.loading && <p className="ws-nav-note">Loading channels…</p>}
                            {list?.error && (
                              <p className="ws-nav-note is-error">{list.error}</p>
                            )}
                            {!list?.loading && !list?.error && entries.length === 0 && (
                              <p className="ws-nav-note">{connector.note}</p>
                            )}
                            {entries.map((channel) => (
                              <Row
                                key={channel.id}
                                leaf
                                label={`#${channel.name}`}
                                tag={channel.watched ? 'synced' : undefined}
                                title={channel.name}
                                active={
                                  nav.selection === channelSelectionId(connector.key, channel.id)
                                }
                                onClick={() =>
                                  onSelect(channelSelectionId(connector.key, channel.id))
                                }
                              />
                            ))}
                          </>
                        )}
                      </div>
                    )
                  })
                ) : (
                  section.rows.map((row) => (
                    <Row
                      key={row.id}
                      icon={row.icon}
                      label={row.label}
                      title={row.desc}
                      active={rowActive(row)}
                      count={rowCount(view, row.id)}
                      onClick={() => onSelect(row.id)}
                    />
                  ))
                ))}

            </Fragment>
          )
        })}
      </nav>

      <div className="ws-nav-footer">
        <Row
          fixed
          icon="settings"
          label="Settings"
          title="Settings"
          active={nav.openGroup === 'settings'}
          onClick={() => onOpenGroup('settings')}
        />
      </div>

      {!collapsed && (
        <div
          className="ws-nav-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={nav.width}
          aria-valuemin={NAV_WIDTH_MIN}
          aria-valuemax={NAV_WIDTH_MAX}
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize}
          onKeyDown={onResizeKey}
          onDoubleClick={() => onResize(NAV_WIDTH_DEFAULT)}
        />
      )}
    </aside>
  )
}
