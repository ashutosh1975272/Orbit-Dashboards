# Single-Sidebar Expanded Workspace — Design

**Date:** 2026-10-25
**Status:** Approved for implementation planning
**Scope:** Replace the expanded project card's 10-tab / 3-pane layout with one Claude-style left sidebar (Agent chat · Visualization · Summary) plus a single content panel, and make Agent chat a real, grounded, project-scoped Q&A surface.

---

## 1. Problem

Today an expanded card (`ExpandedWorkspace.tsx`) shows a **10-tab strip** (Summary, Slack Chat, AI Chat, Requirements, Scope, Decisions, Commitments, Files, People, Settings). The Summary tab itself is a **3-pane** layout: left rail of visuals, centre summary, right rail of 7 "Project Details" cards. This is dense, the tab strip is wide and wraps at narrow widths, and the AI Chat tab is a placeholder that does nothing.

The user wants the workspace to feel like Claude's own sidebar: a small set of top entries that expand to reveal their options **underneath in the same rail**, everything reachable from the left (the right-hand Project Details move left), one clean content area, low density, and an Agent that can answer anything about the project.

**Hard constraints carried from the standing brief:**
- The **primary app sidebar is frozen** — nothing in this spec touches it. This sidebar lives *inside the project card*.
- Raw AI keys stay in the **main process**; the renderer only ever receives masks and answer text.
- Agent chat obeys the **no-guess rule**: it answers only from the project context it is given; otherwise it returns exactly `Chat mein yeh nahi mila.`
- UI is verified in the **native Electron window over CDP**, never a browser tab.

---

## 2. Target shape

```
┌─────────────────────────────────────────────────────────────┐
│ CardHead  (unchanged: name · workspace · client · AI badge   │
│            · flags · Sync / Settings / Remove / collapse)     │
├──────────────┬──────────────────────────────────────────────┤
│ WS SIDEBAR   │  CONTENT PANEL                               │
│              │  (one body, chosen by the sidebar selection)  │
│ ▸ Agent chat │                                               │
│ ▸ Visualiz.  │    Progress · Time elapsed · Last 7 days      │
│     · Progress│   OR Summary stack OR a detail/guide section  │
│     · Time   │   OR Slack chat OR Settings                   │
│     · 7 days │                                               │
│ ▸ Summary    │                                               │
│     (13 opts)│                                               │
│              │                                               │
│ ─────────────│                                               │
│ [Slack Chat] │                                               │
│ [ Settings ] │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

- **Two columns** below `CardHead`: a workspace **sidebar** and a single **content panel**. The old `ws-tabs` strip is removed entirely.
- **Sidebar nav entries (top, accordion):** `Agent chat`, `Visualization`, `Summary`. Only one entry is expanded at a time; expanding a different one collapses the previous.
- **Sidebar footer (pinned, always visible):** `Slack Chat`, `Settings` — compact icon+label buttons that open their panel in the content area.
- **Collapse:** the sidebar collapses to an icon rail; the content panel reclaims the width. Collapse state persists per project.

### 2.1 What each entry reveals

| Entry | Expands to | Content panel shows |
|---|---|---|
| **Agent chat** | (leaf — no sub-buttons) | `AgentChatPanel` |
| **Visualization** | `Progress`, `Time elapsed`, `Last 7 days` | Pick one → that chart alone (large). Collapsed default (no sub-option selected) → all three stacked. |
| **Summary** | 13 options in one flat list (sub-headings optional) | The Summary default is the existing `CentreContent` stack; picking any of the 13 swaps that detail into the panel. |
| **Slack Chat** (footer) | — | `SlackChatTab` (existing) |
| **Settings** (footer) | — | `ProjectSettingsTab` (existing) |

**The 13 Summary options** = the 7 current Project Details (`DETAIL_CARDS`: Needs Reply, Blockers, Risks, Next Steps, Mood, Activity, History) + the 6 guide sections (Requirements, Scope, Decisions, Commitments, Files, People). Their bodies already exist as `DetailBody` (from `rightSidebar`) and `GuideDetailBody` (from `leftSidebar`) — reused unchanged.

**Default on open:** `Summary` expanded, no detail selected → the `CentreContent` stack. This keeps the current landing view intact.

> Note: the standalone Slack **channel rail** (public channels + private groups, drag-resizable) discussed earlier is **out of scope** for this spec. It attaches to `SlackChatTab`, which this redesign preserves as-is. It can be a follow-on.

---

## 3. Components (renderer)

New files, each with one purpose and a testable seam:

- **`WorkspaceSidebar.tsx`** — the nav rail. Renders the three accordion entries, the pinned footer, and the collapse toggle. Owns **no content**. Props: current nav state + callbacks (`onToggleGroup`, `onSelectItem`, `onToggleCollapse`). Emits selections up to the shell.
- **`WorkspaceContent.tsx`** — the single right panel. Pure mapping: given `{ group, selection }`, render the matching body (`AgentChatPanel` | `CentreVisuals` stacked/single | `CentreContent` | `DetailBody`/`GuideDetailBody` | `SlackChatTab` | `ProjectSettingsTab`). This mapping is unit-tested.
- **`AgentChatPanel.tsx`** — replaces the `AiChatTab` placeholder. Message thread + composer; calls `window.api.dashboard.askAgent`; renders the no-guess fallback verbatim; handles `no_key`/`provider` error states inline.
- **`useWorkspaceNav.ts`** — per-project persisted nav state under `orbit.workspace.nav.<projectId>`: `{ openGroup, selection, collapsed }`. Mirrors the existing `useSidebarCollapse` pattern (localStorage, guarded try/catch). Selection vocabulary:
  - `openGroup`: `'agent' | 'visual' | 'summary'`
  - `selection`: `null` (Summary default) | `'all' | 'progress' | 'time' | 'week'` (visual) | one of `DetailKey` (7) | one of guide section numbers (6) | `'slack' | 'settings'` (footer).
- **`ExpandedWorkspace.tsx`** — becomes the shell: keep `CardHead`, delete the `ws-tabs` strip and `WorkspaceTab`/`TabDef` machinery, render `<div className="ws-shell-body">` with `WorkspaceSidebar` + `WorkspaceContent`. Preserve the external entry props (`initialTab`, `initialGuideSection`, `initialDetailKey`) by translating them into the new nav vocabulary on mount (a small pure mapper, tested).

**Reused unchanged:** `CardHead`, `CentreContent`, `CentreVisuals`, `SlackChatTab`, `ProjectSettingsTab`, `guide-content` (`DetailBody`, `GuideDetailBody`), `guide-model` (`DETAIL_CARDS`, `detailMeta`).

`useSidebarCollapse` (left/right) is retired for the Summary layout (there is no right rail any more); replaced by `useWorkspaceNav`'s single `collapsed`.

---

## 4. Agent chat — data flow (main process)

### 4.1 Contract
New IPC channel:
- **`DashboardAskAgent: 'dashboard:ask-agent'`**
- Request payload `DashboardAskAgentPayload`: `{ projectId: string; question: string; history: Array<{ role: 'user' | 'assistant'; text: string }> }`
- Response `DashboardAskAgentResult`:
  - `{ ok: true, answer: string }`
  - `{ ok: false, code: 'no_key' | 'provider' | 'invalid_input', error: string }`
  - `answer` is **always** either a grounded reply or the exact fallback string — never an ungrounded guess.

Types live in `src/shared/dashboard-contract.ts`; channel id + method signature in `src/shared/ipc-contract.ts`; exposed as `window.api.dashboard.askAgent(payload)` in `src/preload/index.ts`.

### 4.2 Service
New **`DashboardAgentService`** in `src/main/dashboard/agent-service.ts`, constructed in `src/main/index.ts` beside `DashboardChatService` and passed into the dashboard IPC deps. Dependencies (all already exist):
- `aiSettings.getProvider(projectId)` → `NimProvider | null` (key never leaves main).
- `chatService.loadMessages(...)` → recent stored messages (via the existing `DashboardChatQueryPayload`).
- `insightEngine.existingInsight(projectId)` → the latest `ProjectInsight | null` (already used in `index.ts`; no new accessor needed).

### 4.3 Context builder (pure + testable)
`buildAgentContext(insight, messages) -> string` assembles the system block:
- **Insight fields** (present-only, never placeholder): situation line, status + reason, recent change, next step, blockers (what/who), risks, requirements, decisions, commitments, in/out scope + deliverables, mood + reason, activity counts, people, channel names.
- **Recent messages:** the newest **~40 displayable** messages (reuse the chat service's `isDisplayable` filter), each as `[#channel] name: text`, newest last.
- Ordering: insight block first, then messages, so the model sees the distillation before the raw thread.
- Hard cap on total characters to bound cost; if truncation is needed, drop oldest messages first (keep insight intact).

### 4.4 Prompting rule
System prompt instructs: answer only from the provided context; if the context does not support an answer, reply with exactly `Chat mein yeh nahi mila.` — no invention, no hedging with outside knowledge. `NimProvider.chat()` returns the assistant text; single request/response in v1 (no streaming). Conversation `history` is replayed ahead of the new question so follow-ups resolve.

### 4.5 What "ask everything" covers
Because the context is insight + last N messages, the agent can answer status, blockers, requirements, scope, decisions, commitments, "what did the client last say", "what's next", mood, and general summarisation — anything those fields support. Questions outside the context hit the fallback.

---

## 5. Error handling

| Condition | `code` | Panel behaviour |
|---|---|---|
| No API key configured (project or global or env) | `no_key` | Inline one-liner: "Add an API key in Settings to use the agent." Composer stays visible but sends nothing useful; no crash. |
| Provider error / timeout / bad response | `provider` | Inline "Agent didn't answer. Try again." Keep prior messages; allow re-send. |
| Empty / oversized question | `invalid_input` | Disabled Send until non-empty; oversized trimmed client-side. |
| No insight yet for the project | (ok) | Context is messages-only; still grounded; fallback rule unchanged. |
| Slack not connected / no messages | (ok) | Context is insight-only; still answers insight questions. |

Errors never produce a fabricated answer. The fallback string is returned only for the legitimate "not in context" case, not for errors (those show their own message).

---

## 6. Visual system

Follows the project's Hallmark floor and existing tokens (no new colours/fonts; token-driven only):
- Sidebar is a **flat hairline-divided rail** (accent only for the active/selected item). No card-in-card, no gradients, no emoji icons — reuse the existing inline SVG glyph style from `CardHead`'s gear.
- Nav entries: label in the body face (never tracked-caps), a leading icon, a chevron that rotates on expand (transform only). Sub-options indented, un-truncated with ellipsis.
- Selection uses the existing accent token; focus-visible ring on every control, appears instantly.
- Accordion expand animates opacity/transform, never `height`/`width`; `prefers-reduced-motion` fallback shows content immediately.
- Low density: generous padding, about 80 words of visible chrome, one idea per screen. Content panel reuses existing `ws-panel`/`ws-center-scroll` styling so Summary/visuals look as they do today.

---

## 7. Testing

**Unit (Vitest):**
- `buildAgentContext` — serialises present insight fields, omits empty ones, caps messages at ~40, keeps insight on truncation, stable ordering.
- No-guess rule — provider stub returning the fallback yields exactly `Chat mein yeh nahi mila.`; a grounded stub yields its answer.
- `DashboardAgentService` — with a fake provider + fake insight/messages: `no_key` path (provider null), `provider` path (chat throws), happy path passes the built context + history to the provider.
- `useWorkspaceNav` — accordion (only one group open), per-project persistence, collapse toggle, selection round-trips.
- `WorkspaceContent` mapping — each `{group, selection}` resolves to the expected body; Visual `null`→stacked, `progress`→single.
- Entry-prop mapper — `initialTab`/`initialGuideSection`/`initialDetailKey` translate to correct nav state.

**UI proof (native Electron over CDP 9222):**
- `pnpm run build` green; typecheck green; full unit suite green (162-test baseline; lint-red is pre-existing and reported as such, not masked).
- Launch the built app, open Dashboard, switch a card to expanded, and screenshot: (1) default Summary open, (2) Visualization expanded with a single chart + stacked, (3) Summary's 13 options revealed, (4) sidebar collapsed to icon rail, (5) footer Slack/Settings opening their panels, (6) an Agent chat round-trip showing a grounded answer and the fallback on an out-of-context question.
- Confirm no horizontal overflow at wide/narrow widths and that the **primary app sidebar is byte-identical** (unchanged file).

---

## 8. Out of scope
- Streaming responses (v1 is request/response).
- The standalone Slack channel rail (public channels + private groups, resizable) — follow-on; `SlackChatTab` preserved as-is.
- MCP tool-calling / on-demand fetching by the agent (the deferred Stage 2).
- Any change to the frozen primary app sidebar or the main-process secret handling.

---

## 9. Success criteria
1. Every expanded card shows **one left sidebar + one content panel**; no tab strip remains.
2. Agent chat answers real project questions grounded in insight + messages, and returns **exactly** `Chat mein yeh nahi mila.` when it cannot — never a guess.
3. All 13 Summary options + the 3 Visualization sub-options + Slack + Settings are reachable from the sidebar/footer; nothing from the old layout is lost.
4. Sidebar collapse + selection persist per project across reloads.
5. Looks clean and consistent across cards at wide and narrow widths; primary app sidebar untouched; build + typecheck + tests green.
