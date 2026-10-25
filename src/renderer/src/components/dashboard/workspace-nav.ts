/** Workspace nav model for the single-sidebar expanded card (v5 layout).
 * Four dropdown sections (Xomni / Slack / Project info / Visualizations) sit
 * under Dashboard, with Settings pinned last. Project info nests three
 * sub-groups that start closed. `NAV_SECTIONS` is the single source for the
 * sidebar tree, the row labels and copy, and selection validity — so the
 * dropdown rules, the legacy-state migration, the deep-link translation and
 * the selection→body map can all be unit-tested without React or a DOM. */

import type { DetailKey } from './guide-model'

/** Which centre body is showing. Sections own the dropdown open/close state;
 * a row selection owns the body. */
export type OpenGroup = 'dash' | 'xomni' | 'info' | 'slack' | 'viz' | 'settings'

export type SectionKey = 'xomni' | 'slack' | 'info' | 'viz'

export type VisualKey = 'progress' | 'time' | 'week'

export type GuideSection = 2 | 3 | 4 | 5 | 6 | 7

export type XomniModeKey = 'project' | 'agentwork'

/** Which of the two Slack workspaces the chat panel targets. */
export type SlackSourceKey = 'client' | 'team'

export type InfoGroupKey = 'attention' | 'project' | 'signals'

export type SelectionId =
  | `v:${VisualKey}`
  | `d:${DetailKey}`
  | `g:${GuideSection}`
  | `m:${XomniModeKey}`
  | `s:${SlackSourceKey}`

export interface NavRow {
  id: SelectionId
  label: string
  /** One sentence shown under the centre panel heading. UI copy, never data. */
  desc: string
  icon: string
  /** Only rows inside the Project info section carry a sub-group. */
  group?: InfoGroupKey
}

export interface NavSection {
  key: SectionKey
  label: string
  /** Icon shown in the collapsed 56px rail; the expanded header has none. */
  icon: string
  rows: NavRow[]
}

export const INFO_GROUPS: Array<{ key: InfoGroupKey; label: string; icon: string }> = [
  { key: 'attention', label: 'Needs attention', icon: 'alert' },
  { key: 'project', label: 'Project', icon: 'folder' },
  { key: 'signals', label: 'Signals', icon: 'activity' }
]

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'xomni',
    label: 'Xomni',
    icon: 'sparkle',
    rows: [
      {
        id: 'm:project',
        label: 'Chat with project',
        desc: 'Ask anything about this project. Answers come from what this card already knows.',
        icon: 'message'
      },
      {
        id: 'm:agentwork',
        label: 'Talk to AgentWork',
        desc: 'Hand a task to the agent. Opens up once AgentWork is connected.',
        icon: 'robot'
      }
    ]
  },
  {
    key: 'slack',
    label: 'Slack',
    icon: 'slack',
    rows: [
      {
        id: 's:client',
        label: 'Client Slack',
        desc: 'The client workspace for this project. Scroll the messages and reply here.',
        icon: 'inbox'
      },
      {
        id: 's:team',
        label: 'Our Slack',
        desc: 'Our own team workspace, for the channels we pin to this project.',
        icon: 'users'
      }
    ]
  },
  {
    key: 'info',
    label: 'Project info',
    icon: 'summary',
    rows: [
      {
        id: 'd:needs-reply',
        label: 'Needs reply',
        desc: 'Client messages waiting on an answer from us.',
        icon: 'mail',
        group: 'attention'
      },
      {
        id: 'd:blockers',
        label: 'Blockers',
        desc: 'What is stopping work right now.',
        icon: 'ban',
        group: 'attention'
      },
      {
        id: 'd:risks',
        label: 'Risks',
        desc: 'Things called out in chat that could go wrong.',
        icon: 'shield',
        group: 'attention'
      },
      {
        id: 'd:next-steps',
        label: 'Next steps',
        desc: 'The next moves this project is waiting on.',
        icon: 'arrow-right',
        group: 'attention'
      },
      {
        id: 'g:2',
        label: 'Requirements',
        desc: 'Everything the client has asked for.',
        icon: 'list-check',
        group: 'project'
      },
      {
        id: 'g:3',
        label: 'Scope and deliverables',
        desc: 'What is in scope, what is out, and what we hand over.',
        icon: 'target',
        group: 'project'
      },
      {
        id: 'g:4',
        label: 'Decisions',
        desc: 'Calls taken during the project, with where they came from.',
        icon: 'check',
        group: 'project'
      },
      {
        id: 'g:5',
        label: 'Commitments',
        desc: 'Promises made and the dates attached to them.',
        icon: 'flag',
        group: 'project'
      },
      {
        id: 'g:6',
        label: 'Files and links',
        desc: 'Files and links shared in the watched channels.',
        icon: 'paperclip',
        group: 'project'
      },
      {
        id: 'g:7',
        label: 'People and channels',
        desc: 'Who is involved and where they talk.',
        icon: 'users',
        group: 'project'
      },
      {
        id: 'd:mood',
        label: 'Client mood',
        desc: 'How the client sounds in recent messages.',
        icon: 'mood',
        group: 'signals'
      },
      {
        id: 'd:activity',
        label: 'Activity',
        desc: 'Message counts and the last contact either way.',
        icon: 'chart-line',
        group: 'signals'
      },
      {
        id: 'd:history',
        label: 'History',
        desc: 'How the status of this project has moved over time.',
        icon: 'history',
        group: 'signals'
      }
    ]
  },
  {
    key: 'viz',
    label: 'Visualizations',
    icon: 'chart-bar',
    rows: [
      {
        id: 'v:progress',
        label: 'Progress',
        desc: 'How much of the work this card counts as done.',
        icon: 'chart-donut'
      },
      {
        id: 'v:time',
        label: 'Time elapsed',
        desc: 'How much of the agreed timeline has passed.',
        icon: 'hourglass'
      },
      {
        id: 'v:week',
        label: 'Last 7 days',
        desc: 'Message activity across the past week.',
        icon: 'chart-bar'
      }
    ]
  }
]

export interface WorkspaceNavState {
  /** Revision marker written into the persisted blob, so older shapes are
   * never read as v5 (only a v5 blob carries its section open/closed list). */
  rev: number
  openGroup: OpenGroup
  selection: SelectionId | null
  collapsed: boolean
  /** Expanded sidebar width in px (drag-resizable). Ignored while collapsed. */
  width: number
  /** Which dropdown sections currently show their rows. */
  openSections: SectionKey[]
  /** Which Project info sub-groups currently show their rows. */
  openInfoGroups: InfoGroupKey[]
  /** Per-section memory of the last selection, restored by the rail icons. */
  sectionSelections: Partial<Record<SectionKey, SelectionId>>
}

export const NAV_REV = 5

export const NAV_WIDTH_MIN = 180
export const NAV_WIDTH_MAX = 400
export const NAV_WIDTH_DEFAULT = 236
/** Icon-rail width shown when collapsed or auto-collapsed at narrow widths. */
export const NAV_RAIL_WIDTH = 56

const ALL_SECTIONS: SectionKey[] = NAV_SECTIONS.map((s) => s.key)

export function clampNavWidth(px: number): number {
  if (!Number.isFinite(px)) return NAV_WIDTH_DEFAULT
  return Math.min(NAV_WIDTH_MAX, Math.max(NAV_WIDTH_MIN, Math.round(px)))
}

export const DEFAULT_NAV: WorkspaceNavState = {
  rev: NAV_REV,
  openGroup: 'dash',
  selection: null,
  collapsed: false,
  width: NAV_WIDTH_DEFAULT,
  openSections: [...ALL_SECTIONS],
  openInfoGroups: [],
  sectionSelections: {}
}

const ALL_ROWS: NavRow[] = NAV_SECTIONS.flatMap((s) => s.rows)

export function navRowOf(id: SelectionId | null): NavRow | null {
  if (!id) return null
  return ALL_ROWS.find((row) => row.id === id) ?? null
}

function isValidSelection(raw: unknown): raw is SelectionId {
  if (typeof raw !== 'string') return false
  return ALL_ROWS.some((row) => row.id === raw)
}

/** The section that owns a selection. */
export function sectionOfSelection(id: SelectionId): SectionKey {
  return NAV_SECTIONS.find((s) => s.rows.some((r) => r.id === id))?.key ?? 'info'
}

/** The Project info sub-group a selection lives under, if any. */
export function infoGroupOf(id: SelectionId): InfoGroupKey | null {
  return navRowOf(id)?.group ?? null
}

export function isDetailId(id: SelectionId): id is `d:${DetailKey}` {
  return id.startsWith('d:')
}
export function detailKeyOf(id: SelectionId): DetailKey {
  return id.slice(2) as DetailKey
}
export function isGuideId(id: SelectionId): id is `g:${GuideSection}` {
  return id.startsWith('g:')
}
export function guideSectionOf(id: SelectionId): GuideSection {
  return Number(id.slice(2)) as GuideSection
}
export function isVisualId(id: SelectionId): id is `v:${VisualKey}` {
  return id.startsWith('v:')
}
export function visualKeyOf(id: SelectionId): VisualKey {
  return id.slice(2) as VisualKey
}
export function isModeId(id: SelectionId): id is `m:${XomniModeKey}` {
  return id.startsWith('m:')
}
export function modeKeyOf(id: SelectionId): XomniModeKey {
  return id.slice(2) as XomniModeKey
}

/** The active Xomni mode; project chat is the default. */
export function xomniModeOf(nav: WorkspaceNavState): XomniModeKey {
  if (nav.selection && isModeId(nav.selection)) return modeKeyOf(nav.selection)
  return 'project'
}

/** The workspace the Slack panel shows; the card's own workspace is default. */
export function slackSourceOf(nav: WorkspaceNavState): SlackSourceKey {
  return nav.selection === 's:team' ? 'team' : 'client'
}

export function migrateOpenGroup(raw: unknown): OpenGroup {
  switch (raw) {
    case 'summary':
      return 'info'
    case 'visual':
      return 'viz'
    case 'agent':
      return 'xomni'
    case 'dash':
    case 'xomni':
    case 'info':
    case 'slack':
    case 'viz':
    case 'settings':
      return raw
    default:
      return DEFAULT_NAV.openGroup
  }
}

function validSections(raw: unknown): SectionKey[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((k): k is SectionKey => ALL_SECTIONS.includes(k as SectionKey))
}

function validInfoGroups(raw: unknown): InfoGroupKey[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((k): k is InfoGroupKey => INFO_GROUPS.some((g) => g.key === k))
}

function ensure<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value]
}

/** Migrate a v3/v4/v4.1/v5 persisted blob (or reject garbage → null) to v5.
 * Only a v5 blob is trusted for its section open/closed list; anything older
 * starts with all four sections open and the info sub-groups closed. */
export function migrateNavState(raw: unknown): WorkspaceNavState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Record<string, unknown>
  const selection = isValidSelection(parsed.selection) ? parsed.selection : null
  // A remembered row always owns the centre, so the group is derived from it
  // rather than trusted from the blob: the two can disagree in saved states.
  const savedGroup = migrateOpenGroup(parsed.openGroup)
  const openGroup = selection ? sectionOfSelection(selection) : savedGroup

  // Only a v5 blob carries its own open/closed lists. Older shapes start with
  // all four sections open and inherit whatever info groups were open then, so
  // a persisted selection is never hidden behind a closed group.
  const isV5 = parsed.rev === NAV_REV
  const openSections = isV5 ? validSections(parsed.openSections) : [...ALL_SECTIONS]
  let openInfoGroups = validInfoGroups(parsed.openInfoGroups)
  if (!isV5 && selection) {
    const group = infoGroupOf(selection)
    if (group) openInfoGroups = ensure(openInfoGroups, group)
  }

  const remembered = parsed.sectionSelections
  const sectionSelections: Partial<Record<SectionKey, SelectionId>> =
    remembered && typeof remembered === 'object'
      ? Object.fromEntries(
          Object.entries(remembered).filter(
            ([key, value]) =>
              ALL_SECTIONS.includes(key as SectionKey) &&
              isValidSelection(value) &&
              sectionOfSelection(value) === key
          )
        )
      : {}
  if (selection && openGroup !== 'dash' && openGroup !== 'settings') {
    sectionSelections[sectionOfSelection(selection)] = selection
  }

  return {
    rev: NAV_REV,
    openGroup,
    selection,
    collapsed: Boolean(parsed.collapsed),
    width: clampNavWidth(Number(parsed.width ?? DEFAULT_NAV.width)),
    openSections,
    openInfoGroups,
    sectionSelections
  }
}

/** The card-entry props a compact-chip or gear deep-link can carry in. */
export type WorkspaceEntryTab = 'summary' | 'slack-chat' | 'ai-chat' | 'settings'

export interface NavEntry {
  initialTab?: WorkspaceEntryTab
  initialGuideSection?: number
  initialDetailKey?: DetailKey
}

/** Translate the card-entry props into a nav state (compact-chip / gear
 * deep-links) applied ON TOP of the persisted state, so a deep-link moves only
 * the selection: the width, the collapsed rail and any section the user closed
 * survive. Returns null when nothing is forced, so persisted state wins. */
export function navFromEntryProps(
  entry: NavEntry,
  base: WorkspaceNavState
): WorkspaceNavState | null {
  const withRow = (selection: SelectionId): WorkspaceNavState => ({
    ...base,
    selection,
    openGroup: sectionOfSelection(selection),
    sectionSelections: {
      ...base.sectionSelections,
      [sectionOfSelection(selection)]: selection
    },
    openSections: ensure(base.openSections, sectionOfSelection(selection)),
    openInfoGroups: (() => {
      const g = infoGroupOf(selection)
      return g ? ensure(base.openInfoGroups, g) : base.openInfoGroups
    })()
  })

  if (entry.initialDetailKey) return withRow(`d:${entry.initialDetailKey}`)
  const guide = entry.initialGuideSection
  if (guide !== undefined && guide >= 2 && guide <= 7) {
    return withRow(`g:${guide as GuideSection}`)
  }
  switch (entry.initialTab) {
    case 'slack-chat':
      return withRow('s:client')
    case 'ai-chat':
      return withRow('m:project')
    case 'settings':
      return { ...base, openGroup: 'settings', selection: null }
    case 'summary':
      return { ...base, openGroup: 'dash', selection: null }
    default:
      return null
  }
}

/** Clicking Dashboard or Settings: its body, no row selection. */
export function openGroupNav(prev: WorkspaceNavState, group: OpenGroup): WorkspaceNavState {
  return { ...prev, openGroup: group, selection: null }
}

/** Toggle one dropdown section. Never changes what the centre panel shows. */
export function toggleSectionNav(prev: WorkspaceNavState, key: SectionKey): WorkspaceNavState {
  const openSections = prev.openSections.includes(key)
    ? prev.openSections.filter((k) => k !== key)
    : ensure(prev.openSections, key)
  return { ...prev, openSections }
}

/** Toggle one Project info sub-group; several can stay open. */
export function toggleInfoGroupNav(
  prev: WorkspaceNavState,
  key: InfoGroupKey
): WorkspaceNavState {
  const openInfoGroups = prev.openInfoGroups.includes(key)
    ? prev.openInfoGroups.filter((k) => k !== key)
    : ensure(prev.openInfoGroups, key)
  return { ...prev, openInfoGroups }
}

/** Clicking a row: activates its body, remembers it for its section, and makes
 * sure the row is visible (its section and sub-group open). */
export function selectNav(prev: WorkspaceNavState, selection: SelectionId): WorkspaceNavState {
  const section = sectionOfSelection(selection)
  const group = infoGroupOf(selection)
  return {
    ...prev,
    openGroup: section,
    selection,
    sectionSelections: { ...prev.sectionSelections, [section]: selection },
    openSections: ensure(prev.openSections, section),
    openInfoGroups: group ? ensure(prev.openInfoGroups, group) : prev.openInfoGroups
  }
}

/** The collapsed rail icon for a section: what it selects when clicked.
 * Project info has no default body of its own, so it returns null until
 * something has been picked there. */
export function railSectionSelection(
  nav: WorkspaceNavState,
  key: SectionKey
): SelectionId | null {
  const remembered = nav.sectionSelections[key]
  if (remembered && sectionOfSelection(remembered) === key) return remembered
  if (key === 'xomni') return 'm:project'
  if (key === 'slack') return 's:client'
  if (key === 'viz') return 'v:progress'
  return null
}

/** Commit a dragged sidebar width (clamped). Keeps the current group/selection. */
export function resizeNav(prev: WorkspaceNavState, width: number): WorkspaceNavState {
  const next = clampNavWidth(width)
  return prev.width === next ? prev : { ...prev, width: next }
}
