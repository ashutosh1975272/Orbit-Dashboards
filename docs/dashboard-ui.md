# Orbit Dashboard — Complete UI Reference

> **Scope:** Everything the Dashboard page renders — the page shell, the focus line, the dense project row, and the full (expanded) workspace — with the exact labels, data sources, and behaviours from the code.
>
> **Code map:** `src/renderer/src/components/dashboard/` (renderer) · `src/main/dashboard/` (main process) · `src/shared/dashboard-contract.ts` (types)

---

## 1. What the Dashboard is

The Dashboard is a **local intelligence view over Slack client projects**. Each project = one workspace + a set of watched channels. The app polls Slack every 300 s (5 min), stores messages locally, and an insight engine (NVIDIA NIM, with a local heuristic fallback) distils them into a project card.

- **One card = one workspace/project.** Two workspaces are never merged on a card; the workspace name is always visible.
- **Everything is local.** Messages live in JSON under `<userData>/dashboard/`; the only network calls are Slack polling and the optional AI insight call.
- **One writable surface: Slack Chat.** The dashboard itself is read-only except for the **Slack Chat** tab, which posts replies with `chat.postMessage` (needs the `chat:write` scope) to a watched channel. No other tab or card action writes to Slack.

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
│ Client projects                 [Compact|Expanded|Mixed] [⋯] [New project] │
│ 1 project · Synced 4m ago · Every 5 min                      │
├──────────────────────────────────────────────────────────────┤
│ Across workspaces  Reply to AgentWork client confirming …    │
├──────────────────────────────────────────────────────────────┤
│ project row (compact) — expands in place into the workspace  │
│ … more rows …                                                │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Header (`dash-head`)

One header owns the page: title, a quiet status sub-line, view mode, the actions menu and the primary action.

| Control | Label | Behaviour |
|---|---|---|
| Title | `Client projects` | Static |
| Status sub-line | `1 project · Synced 4m ago · Every 5 min` | Project count, freshness of the newest sync (`just now` / `Xm ago` / `Xh ago` / `Xd ago`), poll interval from `snapshot.syncIntervalSeconds`. While syncing the middle item reads `Syncing 2/5` |
| View mode | `Compact / Expanded / Mixed` | Sets `viewMode`; persisted to `localStorage['orbit.view']`. `Compact` clears `expandedIds`, `Expanded` fills it |
| ⋯ menu | **AI settings**, **Sync all now**, **Collapse all**, **Expand all** | AI settings opens the dashboard-level fallback panel; Sync all calls `syncNow()` with no id; Collapse/Expand all rewrite `expandedIds` |
| Primary | `New project` | Opens the 5-step DashboardWizard |

### 2.2 Focus line (`dash-focus`)

- Rendered only when `snapshot.digest` exists.
- Label `Across workspaces` + `digest.topPriority` — the single most urgent thing **across all workspaces** (≤20 words). This is the only place workspaces are combined.
- Built by the digest engine (`src/main/dashboard/digest.ts`), source `ai` or `local`.

### 2.3 Project list (`dash-list`)

- One `ProjectCard` per snapshot, each wrapped in its own `ErrorBoundary` (a broken card cannot take down the page).
- Rows stack vertically at full width with a 6 px gap and a hairline between rows; every row expands **in place** into the full workspace (no modal, no second page).
- **Empty state** (`empty-state`): shown when there are zero projects — a `+` mark, the 5-step setup in one sentence (create Slack app → token → channels → card → live sync) and a `New project` button.

**View-mode semantics**

| Mode | What renders |
|---|---|
| **Compact** | Every card is the dense project row; `expandedIds` cleared |
| **Expanded** | Every card is the full workspace card |
| **Mixed** (default) | Per-card state: a card is expanded if its id is in `expandedIds` |

### 2.4 Page-level states

| State | What you see |
|---|---|
| Loading (no snapshot yet) | Centred spinner + `Loading dashboard…` |
| Load error | `Failed to load dashboard` + message + `Retry` |
| Render error (boundary) | `Dashboard Error` + message + `Retry` (clears error and reloads) |
| Auto-refresh | `loadSnapshot()` every 60 s while the page is open |

### 2.5 Wizard overlay

When `wizardOpenFor` is set, `<DashboardWizard />` renders over the page. It is the same wizard used by `New project` and by each project's Settings tab (edit mode, prefilled).

---

## 3. Recent feed (backend only)

**v2.8:** the horizontal Recent strip was removed from the page — the focus line already surfaces the single most urgent item, and the project rows carry per-project state. The ranked feed is still built in the main process and served over `dashboard:get-recent`, so a future surface can consume it without rework.

**Purpose of the feed:** the newest *important* changes across all workspaces, one item per project, ranked by importance — not by time.

### 3.1 Feed item shape

| Field | Source | Notes |
|---|---|---|
| `teamName` | workspace | Always present — hard rule: workspace never hidden |
| `status` | insight / heuristic | `on-track` · `at-risk` · `blocked` · `waiting-on-client` |
| `projectName` | project record | Bold in any future UI |
| `oneLine` | insight `recentLine`, else newest non-noise message | ≤110 chars |
| `needsReply` | insight | True when a reply is owed |
| `delta` | status history | Status change, e.g. `at-risk → on-track` |
| `ts` | newest message | Rendered as `now` / `14m` / `3h` / `14d` |
| `channelName` | newest message | The channel it came from |

### 3.2 How items are built & ranked

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
Agentwork  [Waiting on client] [Needs my reply]   AgentWork  Agentwork-Application
AI 7h ago  private/nvidia/nemotron-3.5-super-120b-a12b            [Sync] [Collapse] [⋯]   ← CardHead
[ Summary ] [ Slack Chat ] [ Agentwork ] [ Project Requirements 1 ] [ Scope & Deliverables ]
[ Decisions 0 ] [ Commitments 0 ] [ Files & Links 0 ] [ People & Channels 2 ]      [ Settings ]
┌──────────────────┬──────────────────────────────┬──────────────────┐
│ Overview         │  centre content              │ Project Details  │
│ progress, time,  │  situation · just changed ·  │ Needs Reply  2   │
│ 7-day activity   │  next step · highlights      │ Blockers     0   │
└──────────────────┴──────────────────────────────┴──────────────────┘
```

### 4.1 No breadcrumb

The card expands in place in the project list, so the row itself supplies context; the old `Workspaces › <project>` line was removed.

### 4.2 Status flags in the header

Only the states that are actually true render, as compact chips beside the project name:

| Chip | Rendered when | Tone |
|---|---|---|
| `On track` / `At risk` / `Blocked` / `Waiting on client` | current `summary.status` | green / amber / red / amber |
| `Needs my reply` | `summary.needsReply` | red |
| `Inactive 24h+` | `summary.inactive` | grey |

There is no row of always-visible, dimmed pills: a state that does not apply is absent, not greyed out.

### 4.3 CardHead — identity and actions

Expanded cards use `CardHead.tsx`. Two halves:

**Left — identity & state**

| Element | Content |
|---|---|
| Project name | 17 px, weight 650, break-word + tooltip |
| Status flags | The chips above, immediately after the name |
| Workspace | `teamName`, faint 12 px text |
| Client | `clientName`, only when it differs from the workspace |
| AI badge | e.g. `AI 7h ago  private/nvidia/nemotron-3.5-super-120b-a12b`, or `no insight yet`; wraps below the identity line on narrow cards |

**Right — actions**

| Button | Label | Action |
|---|---|---|
| Sync | `Sync` (or `Syncing…`, disabled) | `syncNow(projectId)` |
| Collapse | `Collapse` | Collapses in place, scrolls the row to the top, flashes it |
| Menu | `⋯` | **Project settings** (opens the Settings tab) · **Delete project** (red) |

### 4.4 Tabs (10 tabs)

The tab bar **wraps** onto a second line when the card is narrow — no horizontal scrollbar. Settings is pushed to the right edge of the last row.

| Tab | What it shows |
|---|---|
| **Summary** (default) | Three panes: left visuals (progress donut, time bars, 7-day activity), centre a flat stack (situation, just changed, next step / highlights / last client message) with hairline dividers instead of nested cards, right 7 Project Details cards. Detail cards open in the centre; the back button returns to the summary. Sidebars collapse to a 40 px rail and persist per project. |
| **Slack Chat** | Locally stored messages from the project's watched channels (delta store): sender, time, text, `#channel` chip. Channel filter, auto-scroll to newest, older pages load on scroll-up. The composer posts replies through `dashboard:send-message` → `chat.postMessage`; sends update optimistically and errors show inline. **This is the only writable surface.** |
| **&lt;Project name&gt;** | Project-scoped AI chat (placeholder for now). Label = project name. |
| **Project Requirements** | Full-width guide section 2: requirement text, source-file chip, `by <who>`, timestamp. Empty: "No requirements found in chat". |
| **Scope & Deliverables** | Full-width guide section 3 (in scope / out of scope / deliverables). |
| **Decisions** | Full-width guide section 4. |
| **Commitments** | Full-width guide section 5. |
| **Files & Links** | Full-width guide section 6 (type chip, shared by, date, Open link). |
| **People & Channels** | Full-width guide section 7 (people with Client/Us, channels with message count). |
| **Settings** | Per-project configuration, pinned right: AI key/model (or **Use global settings**), workspace & channels (the wizard rendered inline), and manual schedule/completion. See §4.4.1. |

Data tabs carry a count badge that dims at zero. The numbered Project Guide left nav and the standalone Chat/Project Guide/Files tabs from the pre-v2.6 layout are gone; the section bodies described below are the data-tab bodies.

#### 4.4.1 Settings tab (v2.7)

The card-header **⋯ → Project settings** (or the compact row's `⋯`) opens this tab instead of a modal. It has three sections:

| Section | Controls | Behaviour |
|---|---|---|
| **AI settings** | Provider (`NVIDIA NIM`), Model dropdown (loaded from `dashboard:list-ai-models`), API key (password field with **Show/Hide**), **Use global settings** | Stored per project. With the toggle on, the project key/model are ignored and the dashboard settings apply. The **EFFECTIVE NOW** box shows e.g. `Using global: nvidia/nemotron-3.5-super-120b-a12b · global key ••••abcd`. Only the mask ever reaches the renderer; keys are encrypted with `safeStorage` in the main process. |
| **Workspace & channels** | Summary line + **Edit workspace & channels** | Mounts the 5-step `DashboardWizard` inline (starts at channel selection, preserves OAuth connectors). Saving triggers a sync. |
| **Schedule & completion** | Start date, End date, Completion % (0–100) | Writes through `upsertProject`; manual values win over dates/percentages extracted from chat. |

The dashboard-level panel (header **⋯ → AI settings**) edits the same form without a project scope: its key/model are the fallback for every project. Resolution order per field is **project override (unless `useGlobal`) → dashboard global → environment defaults**; the insight engine and project chat both obtain providers through `AiSettingsService.resolveSettings(projectId)`. With no key anywhere, AI features stay off and the card keeps its heuristic insight.

### 4.5 Left panel — Overview (Summary tab)

The left pane of Summary is the project's visual state, not a navigation list:

| Block | Contents | Source |
|---|---|---|
| Progress | Donut `0–100%` with the percentage in the middle | `summary.progress` |
| Time elapsed | Start → due with a pace verdict (behind / on pace / ahead); `Dates not stated in chat` + **Add dates** when missing | `effectiveDates`, `paceLabel` |
| Work done / time used | Flat bars comparing completion against elapsed time | `progress`, `daysUsed/daysTotal` |
| Last 7 days | One bar per day, today in accent, tooltip with the count | `week[]` |

The pane collapses to a 40 px rail with `‹`, persists per project, and the centre `›` toggles the right pane the same way. The guide sections are **tabs**, not a left nav.

**Guide section bodies (the data tabs):**

| # | Body contents |
|---|---|
| 1 | Project start (date + badge: `from chat` / `manual` / `not stated in chat`), Project due, Milestones list (label · date · Done/Open chip) |
| 2 | Requirement cards: text, source file chip, `by <who>`, timestamp |
| 3 | Three blocks: **In scope**, **Out of scope**, **Deliverables** (name + status chip: done / in progress / pending / not started) |
| 4 | Decision cards: what, `by <who>`, when |
| 5 | Commitment cards: what, `by <who>`, `due <date>` |
| 6 | File cards: name, type chip (PDF/DOCX/LINK/IMAGE/OTHER), `shared by`, date, **Open** link |
| 7 | **People** (name · role · Client/Us chip) and **Channels** (#name · message count · `new` chip) |

Each data tab renders its section body full width in the centre; the tab itself carries the count badge. From a Project Details card, the back control returns to the Summary.

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

### 4.7 Schedule & completion (Settings tab)

Moved out of the old ✎ modal. Open the card-header **⋯ → Project settings** → **Settings** tab → **Schedule & completion**.

| Field | Meaning |
|---|---|
| Start date | Blank = use dates found in chat |
| End date / deadline | Project deadline |
| Completion % | 0–100, overrides the activity estimate (blank = auto) |

**Save schedule** calls `upsertProject` with the merged project. The card updates immediately (the snapshot re-derives `effectiveDates` and `completion` from the fresh project record).

---

## 5. The minimised (compact) row

Rendered when the card is collapsed (`compact` mode, or `mixed` + id not in `expandedIds`). It is one dense row rather than a card, so many projects scan in a few seconds.

```
▎ Agentwork  AgentWork  Agentwork-Application  Waiting on client          Needs reply  ▁▁▁▁ 0%  15d  ⋯  ›
▎ Client initiated contact and asked to start; no work has begun yet.
▎ [1 question]
```

A 3 px left bar carries the status colour (`is-on-track` green · `is-at-risk` amber · `is-blocked` red · `is-waiting-on-client` amber).

### 5.1 Row anatomy

| Area | Contents | Source |
|---|---|---|
| Head | Project name (650), workspace, client (only when different), status label | `name`, `workspaceName`, `clientName`, `status` |
| Situation | One line, ellipsis; `No summary yet` fallback | `situationLine` |
| Chips | `N question(s)` · `N blocker(s)` · `N risk(s)` — only when non-zero | `counts` |
| Side | `Needs reply` flag when owed · progress meter + `%` · client-message age | `needsReply`, `progress`, `paceLabel`, `lastClientAt` |
| Actions | `⋯` menu: **Sync now**, **Project settings**, **Delete project** | — |
| Chevron | Opens the full workspace in place | — |

The whole row body is one button (aria-label `Open <name>`); the chips, menu and chevron sit outside it so each keeps its own hit target.

### 5.2 Chips open the matching detail

| Chip | Opens |
|---|---|
| `N question(s)` | Needs Reply detail (101) |
| `N blocker(s)` | Blockers detail (102) |
| `N risk(s)` | Risks detail (103) |

Each chip expands the row and lands on that detail card; there is no second toggle at the bottom of the row.

### 5.3 Compact vs expanded — quick diff

| Aspect | Compact row | Expanded |
|---|---|---|
| Header | inline identity + status label, no actions until `⋯` | CardHead (Sync, Collapse, `⋯`) + status chips + AI badge |
| Status | text label beside the identity, coloured left bar | chips beside the project name |
| Body | one situation line + state chips | 10 tabs + 3-panel Summary |
| Chat | none | Slack Chat (writable) · project AI chat |
| Project guide | none (chips jump into a detail) | full tabs for sections 2–7 |
| Details | progress meter, pace tooltip, client age | 7 detail cards with counts |
| Edit/Delete | `⋯` → Project settings / Delete | Settings tab / `⋯` → Delete |
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
| **Row chips** | `openQuestions`, `blockers`, `risks` lengths (files/requirements live in the tabs) |
| **AI badge** | `AI <age> <model>` (or `heuristic …`, or `no insight yet`); the badge's dot-separated parts render as separate spans, never as a middle-dot string |
| **Synced label** | `synced <age>` from `lastUpdatedAt` |
| **Score** | Same importance formula as the Recent feed (used for ordering/debug) |

**Data flow:** Slack Web API → delta store (JSON per channel) → summary/insight engine → snapshot → IPC `dashboard:get-snapshot` → Zustand `useDashboard` → cards. Sync runs on the 300 s scheduler or on demand (`Sync` / `Sync all`).

---

## 7. Component map

| File | Responsibility |
|---|---|
| `DashboardView.tsx` | Page shell: one header (title, sub-line, view mode, actions menu, New project), focus line, project list, empty/loading/error states, wizard host, dashboard AI settings panel |
| `DashboardRail.tsx` | Sidebar entry (Dashboard → Slack) |
| `ProjectCard.tsx` | Per-project switch between compact/expanded, settings-tab focus, memoised |
| `CardHead.tsx` | Expanded header: identity, true-state chips, Sync/Collapse/`⋯`, AI badge |
| `CompactCard.tsx` | Dense project row: identity, situation, state chips, meter, age, `⋯` |
| `ExpandedWorkspace.tsx` | Full workspace: header, wrapping tab bar, 3-panel Summary |
| `ProjectSettingsTab.tsx` | Settings tab: AI form, inline workspace wizard, schedule/completion |
| `AiSettingsForm.tsx` | Shared AI settings form (project scope and global scope) |
| `AiSettingsPanel.tsx` | Dashboard-level AI settings modal |
| `guide-model.ts` | Guide sections, detail cards, hints, completion, chat-thread builder, date formatters |
| `guide-content.tsx` | Bodies for the 7 guide sections and 7 detail cards |
| `CentreContent.tsx` | Summary centre: one flat stack (Summary, Highlights, Last client message) separated by hairline dividers |
| `CentreVisuals.tsx` | Summary tab visuals (progress donut, time bars, 7-day activity) |
| `card-view.ts` | Pure view-model: `buildCardView`, `buildCardSummary`, all derived values |
| `DashboardWizard.tsx` | 5-step add-project overlay, or inline channel editor in Settings |
| `ErrorBoundary.tsx` | Per-card and page-level crash isolation |
| `src/main/dashboard/recent-feed.ts` | Builds + ranks the Recent feed |
| `src/main/dashboard/digest.ts` | Cross-workspace digest line |
| `src/main/dashboard/ai-settings-store.ts` | Encrypted per-project/global AI settings persistence (`ai-settings.json`) |
| `src/main/dashboard/ai-settings.ts` | `AiSettingsService`: `resolveSettings`, provider cache, masked public views, model list |
| `src/shared/dashboard-contract.ts` | Types for everything above |

---

## 8. Worked example (screenshot: Agentwork)

| Surface | What it shows |
|---|---|
| Header | `Client projects`, sub-line `1 project · Synced 4m ago · Every 5 min`, `Compact / Expanded / Mixed`, `⋯`, `New project` |
| Focus line | `Across workspaces` — `Reply to AgentWork client confirming start and request project details` |
| Project row | Agentwork · AgentWork · Agentwork-Application · Waiting on client · situation line · `1 question` · `Needs reply` · 0% · 15d |
| Expanded header | `Agentwork` + `Waiting on client` + `Needs my reply` chips · AgentWork · Agentwork-Application · `AI 7h ago  private/nvidia/nemotron-3.5-super-120b-a12b` · Sync · Collapse · `⋯` |
| Tabs | Summary · Slack Chat · Agentwork · Requirements 1 · Scope · Decisions · Commitments · Files · People 2 · Settings (gear, right-aligned) |
| Overview left | `0%` progress donut, `Time elapsed — Dates not stated in chat`, time and 7-day activity bars |
| Summary centre | One flat stack with hairline dividers: Situation, Just changed, Next step (`Reply to the client confirming we can start and ask for project details`), Highlights, Last client message |
| Details right | Needs Reply & Open Questions 2 (`can we start here ?`), Blockers 0, Risks 0, Next Steps 1, Client Mood, Activity, History |

This matches the code paths above: one project → one row, tab badges from `view.leftSidebar`/`view.rightSidebar` counts, guide ticks driven by `guideComplete()`, detail counts from `detailMeta()`, situation/next-step text from the insight with the heuristic fallback.

---

*Originally generated from the source at `f369e5d`. Updated for v2.6 (10-tab workspace, writable Slack Chat), v2.8 (single dashboard header, dense project rows, in-place expansion, true-state chips instead of the status/filter strip, Recent strip removed, focus line renamed `Across workspaces`) and v2.9 (flat Summary centre with hairline dividers, short tab labels, icon-only Settings tab). If the card design changes, update this file in the same commit.*
