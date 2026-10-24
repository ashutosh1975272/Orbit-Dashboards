# Orbit Dashboard — Complete UI Reference

> **Scope:** Everything the Dashboard page renders at commit `f369e5d` — the page shell, the Recent strip, the full (expanded) card, and the minimised (compact) card — with the exact labels, data sources, and behaviours from the code.
>
> **Code map:** `src/renderer/src/components/dashboard/` (renderer) · `src/main/dashboard/` (main process) · `src/shared/dashboard-contract.ts` (types)

---

## 1. What the Dashboard is

The Dashboard is a **local, read-only intelligence view over Slack client projects**. Each project = one workspace + a set of watched channels. The app polls Slack every 300 s (5 min), stores messages locally, and an insight engine (NVIDIA NIM, with a local heuristic fallback) distils them into a project card.

- **One card = one workspace/project.** Two workspaces are never merged on a card; the workspace name is always visible.
- **Everything is local.** Messages live in JSON under `<userData>/dashboard/`; the only network calls are Slack polling and the optional AI insight call.
- **Read-only chat.** The dashboard never sends messages — replies go through the embedded Slack view.

### How you open it

Left sidebar → **Dashboard** row (▦ glyph) → expands inline → **Slack** item (`#` glyph) → dashboard opens full-width in place of the Slack embed.

| Element | Behaviour |
|---|---|
| Dashboard row | Toggles the inline dropdown (`dashRailExpanded` in the Zustand store) |
| Slack item | Calls `openDashboard('slack')`; row gets `is-active` styling |
| Close | Navigate to a profile/app in the sidebar, or use the app's normal view switch |

The sidebar state survives re-renders because expansion lives in the store, not component state.

---

## 2. Dashboard page anatomy (top → bottom)

```
┌──────────────────────────────────────────────────────────────┐
│ Client projects — Slack      ● auto-sync every 300s  ⟳ Sync all  + Set up new project │
├──────────────────────────────────────────────────────────────┤
│ DIGEST  Reply to AgentWork client confirming start …         │
├──────────────────────────────────────────────────────────────┤
│ RECENT — MOST IMPORTANT FIRST        All 1 · Urgent 1 · Inactive 24h+ 1 │
│ [ recent mini-card ] [ recent mini-card ] …                  │
├──────────────────────────────────────────────────────────────┤
│ Workspaces ①              Collapse all  Expand all  [Compact|Expanded|Mixed] │
│ ┌ full-width project card (compact or expanded) ───────────┐ │
│ └──────────────────────────────────────────────────────────┘ │
│ … more cards …                                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Header (`page-head`)

| Control | Label | Behaviour |
|---|---|---|
| Title | `Client projects — Slack` | Static |
| Sync status | `● auto-sync every 300s` | Green dot; interval comes from `snapshot.syncIntervalSeconds` (default 300). While syncing it appends ` · syncing 2/5` (current/total projects) |
| Sync all | `⟳ Sync all` | `syncNow()` with no project id → syncs every project |
| New project | `+ Set up new project` | Opens the 5-step DashboardWizard |

### 2.2 Digest bar (`digest`)

- Rendered only when `snapshot.digest` exists.
- Label `DIGEST` + `digest.topPriority` — the single most urgent thing **across all workspaces** (≤20 words). This is the only place workspaces are combined.
- Built by the digest engine (`src/main/dashboard/digest.ts`), source `ai` or `local`.

### 2.3 Workspaces toolbar (`section-head`)

| Control | Behaviour |
|---|---|
| `Workspaces` + count badge | Count = number of project snapshots |
| `Collapse all` | Clears `expandedIds` → every card renders compact |
| `Expand all` | Adds every project id to `expandedIds` |
| Segmented `Compact / Expanded / Mixed` | Sets `viewMode`; persisted to `localStorage['orbit.view']` |

**View-mode semantics**

| Mode | What renders |
|---|---|
| **Compact** | Every card is the compact card; `expandedIds` cleared |
| **Expanded** | Every card is the full workspace card |
| **Mixed** (default) | Per-card state: a card is expanded if its id is in `expandedIds` |

### 2.4 Card grid

- One `ProjectCard` per snapshot, each wrapped in its own `ErrorBoundary` (a broken card cannot take down the page).
- Cards stack vertically, full width, 24 px gap (`space-y-6`).
- **Empty state** (`No project cards yet`): shown when there are zero projects — icon `+`, explanation of the 5-step setup (create Slack app → get token → channels → card → live sync) and a `+ Set up new project` button.

### 2.5 Page-level states

| State | What you see |
|---|---|
| Loading (no snapshot yet) | Centred spinner + `Loading dashboard…` |
| Load error | `Failed to load dashboard` + message + `Retry` |
| Render error (boundary) | `Dashboard Error` + message + `Retry` (clears error and reloads) |
| Auto-refresh | `loadSnapshot()` + `loadRecent()` every 60 s while the page is open |

### 2.6 Wizard overlay

When `wizardOpenFor` is set, `<DashboardWizard />` renders over the page. It is the same wizard used by `+ Set up new project` and by each card's gear button (edit mode, prefilled).

---

## 3. The Recent strip

**Purpose:** the newest *important* changes across all workspaces, one item per project, ranked by importance — not by time.

- Hidden entirely when there are no items (`return null`).
- Horizontal scroll row of fixed-width (236 px) mini-cards; max 6 visible after filtering.

### 3.1 Header

| Element | Detail |
|---|---|
| Title | `Recent — most important first` |
| Filter tabs | `All N` · `Urgent N` · `Inactive 24h+ N` |

| Filter | Includes |
|---|---|
| **All** (default) | Every recent item |
| **Urgent** | `needsReply` OR status `blocked` OR status `at-risk` |
| **Inactive 24h+** | Last activity ≥ 24 h ago |

Counts are computed live from the feed; an empty filter shows `Nothing matches this filter.`

### 3.2 Mini-card anatomy

```
┌──────────────────────────────────┐
│ [Workspace name]      [status]   │  ← workspace pill (truncated 120px) + status chip
│ Agentwork                        │  ← project name, bold
│ Client said "good" in response…  │  ← oneLine, 2-line clamp
│ ⚠ reply  ↑ at-risk→on-track  14d #new-channel │
└──────────────────────────────────┘
```

| Row | Source | Notes |
|---|---|---|
| Workspace pill | `item.teamName` | Always present — hard rule: workspace never hidden |
| Status chip | `item.status` | Colour by status: on-track green, at-risk yellow, blocked red, waiting-on-client purple |
| Project name | `item.projectName` | Bold, truncated |
| One-line summary | `item.oneLine` | From the insight's `recentLine`, else the newest non-noise message (≤110 chars) |
| `⚠ reply` | `item.needsReply` | Yellow, only when a reply is owed |
| `↑ delta` | `item.delta` | Status change, e.g. `at-risk → on-track` |
| Age | `fmtAge(item.ts)` | `now` / `14m` / `3h` / `14d` |
| `#channel` | `item.channelName` | The channel the newest message came from |

Clicking a mini-card calls `onSelect(projectId)` → smooth-scrolls to that project's card and flashes it (`is-flash`, 1.4 s). It does **not** expand the card.

### 3.3 How items are built & ranked

`src/main/dashboard/recent-feed.ts` — pure local data, no LLM/Slack call per item:

1. For each project, take the **newest non-noise message** from its own workspace/channel buckets.
2. Text = insight `recentLine` if present, else the cleaned newest message.
3. Classify the text: `blocker` → `client-question` / `client-message` → `decision` → `delivery` → `chatter` (keyword regexes).
4. Score by importance:

```
score = (needsReply ? 35 : 0)
      + (urgency === 'high' ? 15 : 0)
      + statusWeight   (blocked 30 · at-risk 24 · waiting-on-client 20 · on-track 8)
      + 20 × e^(−hoursSince / 12)      ← recency decay
      + min(15, newMessages)           ← last-sync activity
      − (hoursSince ≥ 48 ? 10 : 0)     ← staleness penalty
```

5. Sort by score desc, then newest first as tie-breaker.

So a workspace **waiting on the client outranks a busy but healthy one**, and a blocked project outranks everything except a direct reply request.

---

## 4. The full (expanded) card

Rendered when the card is expanded (mode `expanded`, or `mixed` + id in `expandedIds`). Root element: `article.ws-shell`, `data-expanded="true"`.

```
Workspaces › Agentwork                              ← breadcrumb
[Active] [Waiting on client] [Needs my reply] [Inactive 24h+]   ← status filter row
#1  Agentwork  [AgentWork]  Client · Agentwork-Application  [waiting-on-client] [Needs my reply]   AI · 3h ago · model   [⟳ Sync] [⚙] [✎] [🗑] [Minimise ⌄]   ← CardHead
[ Chat ] [ Project Guide ] [ Summary ] [ Files ]    ← tabs
┌────────────────┬──────────────────────────────┬──────────────────┐
│ Project Guide  │  centre content              │ Project Details  │
│ 1 Start & Timeline │ (depends on tab/section) │ Needs Reply  2   │
│ 2 Client Requirements │                       │ Blockers     0   │
│ 3 Scope & Deliverables │                      │ Risks        0   │
│ 4 Decisions    │                              │ Next Steps   1   │
│ 5 Commitments  │                              │ Client Mood      │
│ 6 Files & Links│                              │ Activity         │
│ 7 People & Channels │                         │ History          │
└────────────────┴──────────────────────────────┴──────────────────┘
```

### 4.1 Breadcrumb

`Workspaces › <project name>` — static context line above the card.

### 4.2 Status filter row

Four pills, always visible, acting as **state indicators** (not clickable filters):

| Pill | Lit (`is-on`) when |
|---|---|
| `Active` | status is `on-track` |
| `Waiting on client` | status is `waiting-on-client` (yellow) |
| `Needs my reply` | `summary.needsReply` (red) |
| `Inactive 24h+` | `summary.inactive` (grey) |

### 4.3 CardHead (shared header row)

Used by both card variants (`CardHead.tsx`). Two halves:

**Left — identity & state**

| Element | Content |
|---|---|
| `#N` | 1-based card index |
| Project name | Bold 20 px, ellipsis + tooltip |
| Workspace chip | `teamName`, accent outline |
| Client | `Client · <clientName or "Not set">` |
| Status pill | `on-track` green · `at-risk` red-pink · `blocked` amber · `waiting-on-client` purple |
| `Needs my reply` | Red pill when a reply is owed |
| `Inactive 24h+` | Grey pill when no client message for 24 h+ |

**Right — actions**

| Button | Icon/label | Action |
|---|---|---|
| Sync | `⟳ Sync` (or `Syncing…`, disabled) | `syncNow(projectId)` |
| Settings | ⚙ | Reopens the wizard in edit mode for this project (workspace/channels) |
| Edit details | ✎ (expanded only) | Opens the **Edit project** modal |
| Remove | 🗑 (expanded only, red) | Deletes the project (`deleteProject`) |
| Toggle | `Expand ⌄` / `Minimise ⌄` | Collapses/expands the card, scrolls it to top, flashes it |
| AI badge | e.g. `AI · 3h ago · nvidia/nemotron-3.5-super-120b-a12b` | Insight age + model, or `no insight yet` |

### 4.4 Tabs

| Tab | What it shows |
|---|---|
| **Chat** (default) | A synthetic thread built from real insight fields only — never invented messages. Bubbles: last client message (client side), up to 5 highlights, situation line, "Next step: …". Composer is a disabled visual anchor: "Replies go through the Slack workspace view". |
| **Project Guide** | The 7-section guide (left nav) + selected section body in the centre. Opening a detail card from the right rail also renders here. |
| **Summary** | Visual overview (`CentreVisuals`) + textual summary (`CentreContent`). |
| **Files** | Reuses guide section 6 (Files & Links) in the centre panel. |

Tab state: switching to any tab other than `guide` clears the selected detail card.

### 4.5 Left panel — Project Guide (7 sections)

Each row = number/check + title + one-line hint + chevron. The number becomes `✓` when the section is "complete" (has data).

| # | Section | Hint when empty | Complete when |
|---|---|---|---|
| 1 | Start & Timeline | `Dates not stated in chat` | start/end date or any milestone exists |
| 2 | Client Requirements | `No requirements found in chat` | ≥1 requirement |
| 3 | Scope & Deliverables | `Scope not discussed in chat` | in-scope + out-of-scope + deliverables > 0 |
| 4 | Decisions | `No decisions recorded in chat` | ≥1 decision |
| 5 | Commitments | `No commitments found in chat` | ≥1 commitment |
| 6 | Files & Links | `No files shared in this workspace` | ≥1 file |
| 7 | People & Channels | `No people or channels found` | ≥1 person or channel |

**Section bodies (centre panel):**

| # | Body contents |
|---|---|
| 1 | Project start (date + badge: `from chat` / `manual` / `not stated in chat`), Project due, Milestones list (label · date · Done/Open chip) |
| 2 | Requirement cards: text, source file chip, `by <who>`, timestamp |
| 3 | Three blocks: **In scope**, **Out of scope**, **Deliverables** (name + status chip: done / in progress / pending / not started) |
| 4 | Decision cards: what, `by <who>`, when |
| 5 | Commitment cards: what, `by <who>`, `due <date>` |
| 6 | File cards: name, type chip (PDF/DOCX/LINK/IMAGE/OTHER), `shared by`, date, **Open** link |
| 7 | **People** (name · role · Client/Us chip) and **Channels** (#name · message count · `new` chip) |

Navigation: `‹` / `›` in the centre header cycle sections 1→7→1; from a detail card, either arrow returns to the guide. Clicking any section sets the centre title to `<Section title> #N`.

### 4.6 Right panel — Project Details (7 detail cards)

Each is a clickable summary card with a count badge, a tone colour, and a one-line summary. Clicking opens its full body in the centre panel.

| Card | Count | Summary line | Body |
|---|---|---|---|
| **Needs Reply & Open Questions** (danger) | needsReply (0/1) + open questions | First open question, else last client quote, else `No reply needed` | Banner `Needs my reply · <urgency> urgency` or `No reply needed from you`; last client message with who/time; every open question |
| **Blockers** (info) | #blockers | First blocker text, else `None` | Each blocker: what, `owner:`, `since <date>`; empty → `No blockers — work can proceed` |
| **Risks** (warn) | #risks | First risk, else `None` | Each risk prefixed `⚠`; empty → `No risks identified in chat` |
| **Next Steps** (success) | #nextSteps | First next step | Each step prefixed `→`; empty → `No next steps defined yet` |
| **Client Mood & Signals** (accent) | 1 if a mood quote exists | Mood reason or `<mood> mood` | Mood chip (good/neutral/tense), reason, verbatim client quote |
| **Activity** (info) | 1 if any message in 24 h | `24h N · 7d N · client <age>` | 2×2 stats (24h, 7d, Client age, Me age) + last client message + my last reply |
| **History** (muted) | #history entries | `from → to` of latest | Each entry: `from → to`, timestamp, `+N msgs`; empty → `No status changes recorded yet` |

### 4.7 Edit project modal

Opened by ✎ in the CardHead (expanded only). Centred dialog over a dark scrim; click outside or **Cancel** closes it.

| Field | Meaning |
|---|---|
| Start date | Blank = use dates found in chat |
| End date / deadline | Project deadline |
| Manually set completion % | 0–100, overrides the activity estimate (blank = auto) |

**Save** calls `upsertProject` with the merged project and closes the modal.

---

## 5. The minimised (compact) card

Rendered when the card is collapsed (`compact` mode, or `mixed` + id not in `expandedIds`). It is still full width — "minimised" means one dense summary row-set instead of the three-panel workspace.

```
#1  Agentwork  [AgentWork]  Client · Agentwork-Application  [waiting-on-client] [Needs my reply]        [⟳ Sync] [⚙] [Expand ⌄]
┌───────────────────────────────┬──────────────────────┬────────────────────┐
│ Situation (2-line clamp)      │  42%   12 of 30 days │  LAST 7 DAYS       │
│ Just changed: …               │  ▓▓▓▓▓░░░░░░░░░░     │  ▁ ▃ ▅ ▂ ▇ ▄ T     │
│ [NEXT STEP  Reply to …]       │  Sep 1 → Oct 1  ahead│  Client 3h ago     │
│                               │                      │  Me —              │
└───────────────────────────────┴──────────────────────┴────────────────────┘
[2 open questions] [1 blocker] [1 risk] [2 files] [1 requirement]   ← count chips (only non-zero)
[Expand ⌄]                                                          ← bottom toggle
```

### 5.1 CardHead (compact variant)

Same identity block as the expanded card (index, name, workspace chip, client, status, `Needs my reply`, `Inactive 24h+`) plus Sync + ⚙. No ✎/🗑 (edit/delete are expanded-only). Toggle says `Expand`.

### 5.2 Three zones

| Zone | Contents | Source |
|---|---|---|
| **A — situation** (flex 3, min 420 px) | Situation line (16 px semibold, clamped to 2 lines; `No summary yet` fallback) · `Just changed: <recentLine>` in accent · a filled **NEXT STEP** block | insight `situationLine`, `recentLine`, `nextStep` |
| **B — progress & pace** (flex 2, min 300 px) | Big `<progress>%` · `N of M days` · 10 px progress bar · `start → end` ages (or `Dates not stated`) · pace verdict coloured: behind = danger, ahead = accent, on-pace = success | `progress`, `daysUsed/daysTotal`, `dates`, `paceLabel` |
| **C — last 7 days** (flex 1.2, min 200 px) | `LAST 7 DAYS` label · 7 mini bars (today = green `T`, else accent + weekday initial; tooltip `date: N messages`) · `Client <age>` · `Me <age>` | `week[]`, `lastClientAt`, `myLastReplyAt` |

### 5.3 Count chips (row 2)

Only rendered when non-zero. Each chip is clickable and **expands the card directly to the matching detail**:

| Chip | Opens |
|---|---|
| `N open question(s)` | Needs Reply detail (101) |
| `N blocker(s)` | Blockers detail (102) |
| `N risk(s)` | Risks detail (103) |
| `N file(s)` | Guide section 6 — Files & Links |
| `N requirement(s)` | Guide section 2 — Client Requirements |

### 5.4 Toggle

A second `Expand ⌄` button sits at the bottom of the compact card, in addition to the one in CardHead. Both call the same `onToggle` (scroll-to-card + flash). (Note: this duplicates the header toggle — a candidate for cleanup.)

### 5.5 Compact vs expanded — quick diff

| Aspect | Compact | Expanded |
|---|---|---|
| Header | CardHead (Sync, ⚙, Expand) | CardHead (Sync, ⚙, ✎, 🗑, Minimise) + AI badge |
| Status row | pills inside header only | dedicated filter row above header |
| Body | 3 zones + count chips | tabs + 3 panels (Guide nav · centre · Details) |
| Chat | none | synthetic thread + disabled composer |
| Project guide | none (chips jump into it) | 7 sections with completion ticks |
| Details | none | 7 detail cards with counts |
| Edit/Delete | not available | ✎ modal / 🗑 delete |
| Purpose | scan many projects fast | work one project in depth |

---

## 6. How every value is computed

`buildCardSummary()` and `buildCardView()` in `card-view.ts` are pure and testable; the LLM insight wins, the heuristic fallback guarantees a card is never blank.

| Value | Rule |
|---|---|
| **Status** | `insight.status` (on-track / at-risk / blocked / waiting-on-client); `null` with no insight |
| **Situation line** | `insight.situationLine`, else first non-empty line of `snapshot.summary` |
| **Just changed** | `insight.recentLine` |
| **Next step** | `insight.nextStep` |
| **Progress** | `insight.progress` if present, else `snapshot.completion` (manual completion already wins upstream) |
| **Dates** | Insight dates if stated, else project manual dates (`manual` badge), else `not stated in chat` |
| **Days used / total** | From start/end dates; `ceil` day maths in UTC |
| **Pace** | Compare progress % against elapsed-time %: behind / on-pace / ahead, with a label |
| **7-day bars** | Per-day message counts from `perChannel` (last 7 days, today flagged) |
| **Needs reply** | `insight.clientAsk.needsReply` |
| **Urgency** | `insight.clientAsk.urgency` (low / normal / high) |
| **Inactive 24h+** | No last client message AND last sync older than 24 h |
| **Count chips** | `openQuestions`, `blockers`, `risks`, `files`, `requirements` lengths |
| **AI badge** | `AI · <age> · <model>` (or `heuristic · …`, or `no insight yet`) |
| **Synced label** | `synced <age>` from `lastUpdatedAt` |
| **Score** | Same importance formula as the Recent feed (used for ordering/debug) |

**Data flow:** Slack Web API → delta store (JSON per channel) → summary/insight engine → snapshot → IPC `dashboard:get-snapshot` → Zustand `useDashboard` → cards. Sync runs on the 300 s scheduler or on demand (`Sync` / `Sync all`).

---

## 7. Component map

| File | Responsibility |
|---|---|
| `DashboardView.tsx` | Page shell: header, digest, Recent, toolbar, card grid, empty/loading/error states, wizard host |
| `DashboardRail.tsx` | Sidebar entry (Dashboard → Slack) |
| `RecentStrip.tsx` | Recent mini-cards + All/Urgent/Inactive filters |
| `ProjectCard.tsx` | Per-project switch between compact/expanded, edit modal, memoised |
| `CardHead.tsx` | Shared header: identity, status pills, Sync/⚙/✎/🗑/toggle, AI badge |
| `CompactCard.tsx` | Minimised card: 3 zones + count chips |
| `ExpandedWorkspace.tsx` | Full card: breadcrumb, status row, tabs, 3-panel body |
| `guide-model.ts` | Guide sections, detail cards, hints, completion, chat-thread builder, date formatters |
| `guide-content.tsx` | Bodies for the 7 guide sections and 7 detail cards |
| `CentreContent.tsx` | Summary tab text panels (Summary, Highlights, Last Client Message) |
| `CentreVisuals.tsx` | Summary tab visuals (progress donut, time bars, 7-day activity) |
| `card-view.ts` | Pure view-model: `buildCardView`, `buildCardSummary`, all derived values |
| `DashboardWizard.tsx` | 5-step add/edit project overlay |
| `ErrorBoundary.tsx` | Per-card and page-level crash isolation |
| `src/main/dashboard/recent-feed.ts` | Builds + ranks the Recent feed |
| `src/main/dashboard/digest.ts` | Cross-workspace digest line |
| `src/shared/dashboard-contract.ts` | Types for everything above |

---

## 8. Worked example (screenshot: Agentwork)

| Surface | What it shows |
|---|---|
| Header | `Client projects — Slack`, auto-sync 300 s, Sync all, + Set up new project |
| Digest | `Reply to AgentWork client confirming start and requesting project details` |
| Recent (All 1) | Agentwork · waiting-on-client · “Client said "good" in response to a test message” · 14d · #new-channel |
| Workspaces (1) | Agentwork, **Expanded** selected |
| CardHead | `#1 Agentwork` · AgentWork · Client · Agentwork-Application · waiting-on-client · Needs my reply · `AI · 3h ago · nvidia/nemotron-3.5-super-120b-a12b` |
| Status row | Waiting on client lit; Needs my reply lit |
| Guide left | 1 Start & Timeline → `Dates not stated in chat`; 2 Requirements → `1 requirement` ✓; 3 Scope → `Scope not discussed in chat` |
| Chat centre | Utkarsh Barnwal “good” (Oct 10, 10:10 AM); Ashutosh “Client asked if we can start here” (Oct 9, 5:16 PM); Ashutosh requirement note (Oct 9, 5:19 PM) |
| Details right | Needs Reply & Open Questions 2 (`can we start here ?`), Blockers 0 (None), Risks 0 |

This matches the code paths above: one project → one Recent item, guide ticks driven by `guideComplete()`, detail counts from `detailMeta()`, chat bubbles from `buildInsightThread()`.

---

*Generated from the source at `f369e5d`. If the card design changes, update this file in the same commit.*
