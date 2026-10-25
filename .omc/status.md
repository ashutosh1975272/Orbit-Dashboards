# Status Ledger

## Expanded Dashboard — Phase 5 tests, demo fixtures and live proof (2026-10-26, commit `f94b587`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 48 files, **411/411** (exit 0); new `tests/ui/dashboard-page.test.tsx` **12/12**: rich (court chip + tooltip rule, Activity totals `Client · 52` / `Ours · 25` / `77 in 14d`, Time/Mood, six latest rows + source chips + `takeMessageJump` targets `200.9`/`100.3`, `View all` → `s:client`, attention 5 rows + `2 open` + source jump, new-since 6 rows, latest-3 asks order, people/channels, setup hidden, chip hand-off) and sparse (`—` fallbacks, no Activity/duo/Latest/People/attention/new-since regions, `1 of 5` setup, disabled ask + Open settings)
- `npm run build` (production, no env): PASS — renderer **90 modules**, CSS 148.82 kB, JS 1,059.40 kB, assets exactly `index-05b_cbG_.js`, `index-BenAVDrG.css`, `app-icon-CPttgIyR.png` (client 1.80s)
- demo switch proof: `ORBIT_DEMO_DATA=rich npm run build` emitted `mount-demo-Bxty1iWg.js` 12.02 kB + `mount-demo-Byus5-cS.css` 0.65 kB; production rebuild contains **none** — `grep -rIl "Demo data\|demo-rich\|demo-sparse\|Aurora storefront\|demo-watermark\|mount-demo\|ORBIT_DEMO" out/` → `NONE`
- lint (changed TS/TSX files): **0 errors, 0 warnings**, exit 0; `prettier --check` on the same set: all matched
- renderer-only demo: `ORBIT_DEMO_DATA` is a build-time `define`; `mount-demo` dynamically imports fixtures only in the dead demo branch; fixtures override `dashboardApi()` and no-op every action — no delta-store, project-store, disk or Slack write. `Demo data` watermark rendered in both modes. Sparse and rich fixtures live in `src/renderer/src/demo/`.
- six screenshots in `.omc/screenshots/` (committed):
  - `dashboard-sparse-1100.png` 1100x761, `dashboard-sparse-1500.png` 1500x700, `dashboard-sparse-1900.png` 1900x700
  - `dashboard-rich-1100.png` 1100x2072, `dashboard-rich-1500.png` 1500x1449, `dashboard-rich-1900.png` 1900x1449
- live Electron (built bundle, isolated CDP **9240**, temp profiles `/tmp/orbit-demo-sparse` and `/tmp/orbit-demo-rich`; real `~/.config/Electron` and the pre-existing 9222 instance untouched; PIDs 202320/204182 verified via `ps` before `kill`, both stopped):
  - no horizontal overflow at 1100/1500/1900 — `scrollWidth == clientWidth` at every width; `.dash-inner` measures full viewport below 1480 and exactly 1480 above
  - no clipped text: zero `.dash-inner` descendants with `scrollWidth > clientWidth + 1` under hidden/clip overflow at all three widths
  - internal scroll under the app-shell constraint: `.dash-scroll` 2055px content in a 700px viewport, `scrollTop` moved 0 → 240, `.dash-page` stayed within the window
  - responsive shapes: 1100 → KPI 3x2, main full width, rail below in 2 columns; 1500/1900 → KPI 6, main 8 / rail 4
  - sparse shows `1 of 5` setup, disabled ask, `—` KPIs, no empty centre/rail panels; rich shows attention `2 open` + `1 blocker · 2 risks`, 6 new-since rows, deliverables bar and people/channels
  - toast: not rendered in demo mode (every action no-ops); root cause and rect proof stand from Phase 0 (`7b8e78e`), and `tests/unit/shortcut-label.test.ts` (5 tests) proves the toast copy fires only on visible→hidden

## Expanded Dashboard — Phase 4 rail widgets (2026-10-26, commit `3eeb314`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 47 files, **399/399** (exit 0; UI coverage for these widgets lands in Phase 5)
- `npm run build`: PASS — renderer 85 modules, CSS 148.82 kB, JS 1,059.47 kB, client 2.20s (exit 0); only the pre-existing `chrome-cookie-probe` warning
- lint (`DashboardPage.tsx`): **0 errors, 0 warnings** after Prettier; `main.css` is outside eslint's configured extensions
- attention: block renders only once metrics exist; rows are capped at **5**; `N open` uses the deduped waiting count; each row keeps kind, text, source chip, real age and an `Open` that jumps to `c:client:<id>` / `c:team:<id>` (only when a channel exists); the empty line is `Nothing needs you right now.` (analysed) or `Not analysed yet.`
- new since: hidden entirely when the total is 0 (including first visit); count chips unchanged; rows capped at **6**
- setup checklist (rail only, single copy): five rows — Client sync, Client channels, Our Slack channels, Project dates, AI key — with `n of 5`, a per-row action (`Sync now` → sync; the rest open Settings), and the whole block hidden at 5/5. The AI-key probe now runs even when the ask bar is absent.
- client ask: requirements sorted by real `whenIso` (missing/invalid last) and capped at 3; total count and the deliverable bar kept
- people and channels: top 3 each over 14 days from the activity payload (`name`/`#channel` + count); block hidden when both lists are empty
- no live Electron run this phase; layout/overflow proofs remain Phase 5 gates.

## Expanded Dashboard — Phase 3 centre widgets (2026-10-26, commit `4ac71bb`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 47 files, **399/399** tests (exit 0); new: activity-summary 8, chat-service activity 5
- `npm run build`: PASS — main 409.32 kB, preload 18.71 kB, renderer 85 modules, CSS 147.26 kB, JS 1,054.51 kB, client 2.32s (exit 0); only the pre-existing `chrome-cookie-probe` import warning
- lint (changed TS/TSX files): **0 errors, 0 warnings** after Prettier on the two test files; `main.css` is outside eslint's configured extensions
- data path (no LLM, no new token reads):
  - `dashboard:project-activity` validates a non-blank `projectId` (invalid → empty shape) and returns `DashboardProjectActivity`
  - `DashboardChatService.projectActivity` reads only the last **14 days** per delta, caps each channel at **200** rows, caches per project for **60s**, and takes our-side rows only from `project.ourSlackChannels`
  - `buildProjectActivity` (pure) drops `message_changed`, `message_deleted`, `channel_join`, `channel_leave` and empty text; sorts newest-first; returns recent 6, top-3 participants/channels (ties alphabetical), 14d counts
  - ball-in-court rule: no client message → null; no ours message or client ts newer → `you`; otherwise `client`
- UI (`DashboardPage.tsx`, Dashboard-only CSS):
  - hero gained a court chip; its tooltip states the exact rule
  - Activity chart is 160px tall with legend + 14d totals and is not rendered when the last 14 days are empty
  - Latest messages merges both sources (newest 6): initials avatar, name, age, `#channel`, source chip, 2-line text; click calls `requestMessageJump` then opens `c:client:<id>` / `c:team:<id>`; `View all` opens `s:client`
  - Time and pace / Mood trend render only when `time.hasDates` / `trend.length >= 3`, side by side at >=760px; no placeholder panels remain
- not exercised live in this phase: no Electron run; screenshots and live overflow checks are Phase 5 gates.

## Expanded Dashboard — Phase 2 ask bar and KPI honesty (2026-10-25, commit `74f87af`)
- gates re-run at the commit: `npm run typecheck` PASS (exit 0); `npm test` PASS — 46 files, **386/386**; `npm run build` PASS — renderer 84 modules, CSS 145.02 kB, JS 1,050.37 kB, client 2.70s. Lint: 0 errors; one Prettier warning in `agent-chat-panel.test.tsx` was formatted afterwards.
- slim freshness bar with a separate `Sync` action next to the schedules link; no duplicated sync control
- Ask is full width with four suggestion chips; the input is disabled without a key and the muted hint links to Settings. Chips call the same `onAskAgent` path as Enter.
- Ask hand-off is key-aware: when a key exists the chat opens and **auto-sends** the question once status is known; without a key it opens with the question in the composer and does not send (`AgentChatPanel` pending-initial ref).
- KPI changes: 32px/500 values, 12px sentence-case labels, `—` + a concrete reason instead of a fake zero, `Oldest: 16d` / `Age unknown`, separate `N blockers · N risks` sub-line, `Needs 3+ replies to measure`.
- tests: `agent-chat-panel` 14 — auto-send when keyed (exact `{projectId, message}`), no send + composer keeps the question when keyless.

## Expanded Dashboard — Phase 1 layout shell (2026-10-25, commit `ca69a78`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 46 files, **385/385** tests (exit 0)
- `npm run build`: PASS — preload 18.52 kB, renderer 84 modules, CSS 144.17 kB, JS 1,046.66 kB, built 2.56s (exit 0)
- lint (`DashboardPage.tsx`): **0 errors, 0 warnings**; `main.css` is outside eslint's configured extensions
- structure: `.dash-inner` → `.dash-top` (freshness + error + ask), `.dash-kpis`, `.dash-columns` → `.dash-main` (hero, visuals) + `.dash-rail` (attention, new since, client ask). No data or copy changes.
- layout (`main.css`, Dashboard-only):
  - `.dash-page` is the query container (`container-type/name: inline-size dash`), so breakpoints follow the card width, not the window
  - base (<760px): one column; padding `20px 18px 32px`
  - `>=760px`: padding `28px 32px 40px`; KPI `repeat(3)`; rail below main in a 2-column flow
  - `>=1180px`: 12-col `.dash-columns`, KPI `repeat(6)`, main span 8 / rail span 4, gap 20
  - `.dash-inner` max-width 1480, centered; other tabs keep `.ws-content-inner` at 860
- surface: tiles/panels/blocks have no borders, one `color-mix(text 3.5%)` tint, 12px radius; hero 14px at `accent 6%`; the attention tile uses `box-shadow: inset 3px 0 0 var(--warn)`
- fixed card height + internal `.dash-scroll` unchanged
- visual screenshots at 1100/1500/1900 are Phase 5 by plan; this phase's gates are the four commands above.

## Expanded Dashboard — Phase 0c toast root cause + fix (2026-10-25, commit `5bb01ed`)
- root cause (measured in a real Electron window, isolated profile/CDP 9230, real profile untouched):
  - fire condition was `if (collapsed)` after `setSettings` resolved, with no visible→hidden guard (`App.tsx:382-400` before the fix)
  - the direct `setToast` call bypassed the IPC toast timer, so it was still present after 8s
  - nothing cleared it on expand: it was still present 1s after clicking “Show sidebar”
  - copy hardcoded `⌘B` while the key handler accepts `metaKey || ctrlKey`
  - clipping was **not** reproduced: `.app-toast` is `position: fixed`, rect `top 716 / bottom 776` in an 800px viewport (24px margin), and no ancestor has transform/filter/perspective/contain. The screenshot's half-cut toast was a capture crop (dashboard content is cut at the same edge).
- fix:
  - `sidebarToastFor(previous, next)` returns copy only for visible→hidden (`sidebar-toast.ts`)
  - `sidebarCollapsedRef` tracks the real previous state; toast clears on expand and auto-dismisses after 6s (`App.tsx:400-428`)
  - `showToast()` centralises the timer, also used by the existing main-process toast IPC
  - platform labels via `modKeyFor`/`modShiftFor` (`shortcut-label.ts`) in the toast, both sidebar titles, Settings hint and the shortcut line
- live proof after the fix (same isolated window, Linux): hide → `Sidebar hidden — press Ctrl+B…`, rect `716-776/800`, gone at 8s; hide → show within 1s → toast cleared; titles show `Ctrl+B`
- `npm run typecheck`: PASS; `npm test`: **385/385** (46 files); `npm run build`: PASS; lint on all changed/new files: **0 errors**
- tests: `shortcut-label` 5 — Mac/other labels, toast only on visible→hidden, no fire when already hidden, no fire on expand.

## Expanded Dashboard — Phase 0b waiting semantics (2026-10-25, commit `c0bc123`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 45 files, **380/380** tests (exit 0)
- `npm run build`: PASS — renderer 82 modules, client built 2.09s (exit 0)
- lint (all 4 changed files): **0 errors, 0 warnings**
- contract: `DashboardMetrics.waiting` now carries `blockers` and `risks` separately (`dashboard-contract.ts:154-162`)
- `buildWaiting` (`metrics.ts:165-254`):
  - dedupe key = trim, collapse whitespace, lowercase, strip trailing `?.!` (`waitingKey`, `metrics.ts:171-178`); the needs-reply row wins, a matching question is dropped
  - `count` = needs-reply + deduped open questions (blockers/risks excluded)
  - `oldestIso` = oldest real `atIso` among items (`needs-reply.whenIso`, `blocker.sinceIso`); untimed items ignored, none timed → null
  - `blockers`/`risks` counts exposed for the sub-line
- KPI tile: copy `Oldest: …` / `Age unknown` plus a separate `N blockers · N risks` line (`DashboardPage.tsx:402-420`)
- tests: dedupe (count 1 for one question that is also the needs-reply message), blockers/risks excluded from count, all-untimed → null, oldest real timestamp, cap 5 still holds.

## Expanded Dashboard — Phase 0a A5 progress honesty (2026-10-25, commit `baf60fa`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 45 files, **377/377** tests (exit 0)
- `npm run build`: PASS — renderer 82 modules, client built 2.29s (exit 0)
- lint (all 4 changed/new files): **0 errors, 0 warnings** (`CompactCard.tsx`, `card-view.ts`, `dashboard-card-view.test.ts`, `compact-card.test.tsx`)
- production changes:
  - `CardSummary.progress` is `number | null`; `buildCardSummary` uses manual completion → insight progress only when `progressEvidence` is non-empty → null (`card-view.ts:699-708`). The time-based `snapshot.completion` is no longer used.
  - `computeTimeElapsed` returns `paceLabel: 'Progress not stated in chat'` and no pace when progress is unknown (`card-view.ts:274-284`).
  - `CompactCard` renders `—` and `title="Progress not stated in chat"` for null progress (`CompactCard.tsx:146-160`).
  - typed `normalizeInsight`/`toCardClientMessage` to remove the pre-existing `any` lint errors in the touched file (no behaviour change).
- tests:
  - `buildCardSummary — progress honesty` 4: null without evidence, evidenced insight used, manual wins, no completion fallback.
  - `buildCardSummary — pace` +1: no pace claim without evidence.
  - `CompactCard progress` 2 (jsdom): dash + honest title for null, real `50%` when present.

## Chat with project — Phase 4 tests (2026-10-25, commit `eff1222`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 44 files, **370/370** tests (exit 0); **72 new tests in 7 new files**
  - `project-chat-sources` 8: split/bold marker, malformed JSON, hold-back, id parsing, ref mapping/dedupe/limit
  - `project-chat-context` 7: project-state formatting, `m1..mN` id mapping, evidence ordering, history cap 20, 700-char truncation, exact fallback
  - `project-chat-retrieval` 11: BM25 + recency, stopwords, recent-window exclusion, chunk cap, ours source, project isolation, blank rows, unknown project
  - `project-chat-service` 20: stream + host refs, no-answer `[]`, fabricated ids, stop partial `stopped`/no sources, 401/403/429/5xx/network/empty-answer, key missing, RUN_ACTIVE, retry without duplicate user, 200-message cap, clear, status exactly 4 leak-free fields, malformed ids
  - `project-chat-eval` 5: fixtures A–E (recent answer, older keyword, no-answer, fabricated id, injected Slack instruction stays untrusted evidence)
  - `chat-markdown` 8 (jsdom): raw HTML stays text, `javascript:`/`data:`/relative/mailto never anchors, http(s) rel/target, code fence, headings/lists/inline, line breaks
  - `agent-chat-panel` 13 (jsdom): model chip + source badges, hash + settings open, key-missing pause, history + source jump, stream → done, foreign project/run events ignored, Stop, error + retry (no duplicate user), rejected start, clear confirmation, initial question, AgentWork empty state
- `npm run build`: PASS — main 401.85 kB, preload 18.52 kB, renderer 82 modules, client built 1.67s (exit 0); only the pre-existing `chrome-cookie-probe` static+dynamic import warning
- lint (new/changed files): **0 errors, 0 warnings** (prettier autofix); repo-wide 26 pre-existing errors untouched
- production change: one additive regex fix — `MARKER_RE` now also recognizes `**SOURCES:** []` (bold colon inside the bold). All other feature code unchanged.
- test tooling: `jsdom` + `@testing-library/react` dev deps only; `tests/ui/**` typechecked by `tsconfig.web.json`, `tests/unit/**` by `tsconfig.node.json`
- no live Electron run this phase (test-only + marker regex); live proofs from Phases 2/2b/3 remain valid. Stop, Clear chat and history-after-restart are covered by tests here but were not exercised live.

## Chat with project — Phase 3 model selection (2026-10-25, commit `972b3df`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 37 files, **298/298** tests (exit 0, no regressions)
- `npm run build`: PASS — renderer 82 modules, client built 2.27s (exit 0)
- lint (changed files): **0 errors, 0 warnings** (prettier autofix applied; removed a pre-existing `set-state-in-effect` error in `ProjectSettingsTab`)
- live Electron (isolated CDP 9224, temp `--user-data-dir`; real `~/.config/Electron` untouched and temp profile deleted):
  - seeded global `global-model-a` + project override `project-model-b` with a fake key (no network used)
  - chat chip rendered `project-model-b` + `CUSTOM` (`data-model-source="project"`); `getProjectChatStatus` returned exactly `{hasKey, model, modelSource, keySource}` — no key or mask
  - clicking the chip opened the card's Settings tab, focused `#project-ai-settings`, and consumed the one-shot hash
  - Settings showed `Project override is active — chat uses project-model-b` + `Reset to global`; reset switched effective chat to `global-model-a`, removed the banner, and the chat chip became `global-model-a` + `GLOBAL` via the config-changed broadcast (no reload)
  - model list from the provider stays in `AiSettingsForm` (refreshed on demand); provider-backed listing was not exercised live because the temp profile used a fake key

## Chat with project — Phase 2b jump-to-message (2026-10-25, commit `dfaa8e6`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 37 files, **298/298** tests (exit 0, no regressions)
- `npm run build`: PASS — main 401.84 kB, preload 18.52 kB, renderer 82 modules, client built 2.62s (exit 0)
- lint (changed/new files): **0 errors** (main.css is outside eslint's configured extensions)
- live Electron (isolated CDP 9223, temp `--user-data-dir` copied from real dashboard with `ai-settings.json` excluded; real `~/.config/Electron` untouched, temp profile deleted afterwards):
  - chat showed the key-missing state (`No AI key`, answers paused) and the stored history with a `#new-channel` source chip
  - clicking the chip → Slack tab opened `#new-channel` (sidebar item active) and the row with `data-ts="1791546403.167629"` received `is-jump-flash` and programmatic focus
  - fallback: navigation to the channel still occurs when the message is not in the loaded page (helper consumes only on a matching page; otherwise it lands in the channel)
  - crafted source ref existed only in the temp copy; the real chat history was not modified
- helper is reusable by the Dashboard attention SourceChip (A6) later

## Chat with project — Phase 2 UI (2026-10-25, commit `7dc01f3`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 37 files, **298/298** tests (exit 0, no regressions)
- `npm run build`: PASS — preload 18.52 kB, renderer 81 modules, client built 2.12s (exit 0)
- lint (changed/new files): **0 errors** (prettier autofix applied)
- live Electron (built bundle, CDP 9222, real project data): Ask agent bar → chat opened with the question prefilled; model chip showed `nvidia/nemotron-3.5-super-vl-120b-a12b` + `GLOBAL`; empty state + suggestion chips rendered
- live streaming proof: a real NVIDIA reply arrived, was stored in `dashboard/chat/card-mvmbsors-u6ex.json`, and a nonsense question produced exactly `Chat mein ye nahi mila.`; both assistant turns had `sources: []`
- not exercised live: Stop, key-missing state, Clear chat, source chips (Phase 4 tests cover these; no key/settings were modified)
- Clear-chat IPC is now exposed through preload (`clearProjectChat`)

## Chat with project — Phase 1 backend (2026-10-25, commit `0f67b97`)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 37 files, **298/298** tests (exit 0, no regressions)
- `npm run build`: PASS — main 401.75 kB, preload 18.34 kB, renderer 80 modules, client built 1.95s (exit 0)
- lint (all changed/new files): **0 errors, 0 warnings** (prettier autofix); repo-wide 26 pre-existing errors untouched
- shipped: `dashboard:project-chat` + clear/cancel/history/status; sender-scoped chunk/done/error events; preload bridges with unsubscribe; Nim SSE streaming + fallback; host-owned short-id source refs; BM25 + recency retrieval; atomic 200-message per-project history; one run per project; typed error mapping; empty `ProjectTool` seam
- not yet: chat UI (Phase 2), jump-to-message (Phase 2b), model chip/source badge (Phase 3), tests (Phase 4)
- Electron not launched in this phase — backend only, no UI success claimed

## Chat with project — Phase 0 baseline (2026-10-25)
- `npm run typecheck` (node + web): PASS (exit 0)
- `npm test`: PASS — 37 files, **298/298** tests (exit 0)
- `npm run build`: PASS — 80 modules, built in 2.13s (exit 0)
- lint: not a gate for this work; pre-existing 26 errors remain a separate task

## Earlier baseline (2026-10-25, pre-chat)
- typecheck: clean
- lint: 26 errors, 945 warnings
- tests: 267 passed, 28 failed (9 files) — superseded by the 298/298 run above
- commits this session: 5 (4539c37, 2c6114f, d2ed260, da654c7, f46c2d5)

## Items
- A1 Logging: DONE (src/main/logging.ts; tests/audit included)
- A2 Encryption: PARTIAL (block implemented; legacy migration not; UI errors not verified)
- A3 Injection: PARTIAL (prompt lines + progress guard; end-to-end injection test not added)
- A4 Fabrication: DONE (insights.ts; nullable types)
- A5 Dashboard honesty: DONE (duplicate banner removed; compact card progress is manual/evidenced or `—`, tested in `baf60fa`)
- A6 Jump to message: PARTIAL (metadata attached; SourceChip click not implemented)
- A7 LLM gating: PARTIAL (forced zero-new fixed; digest refresh not gated)
- A8 Reconnect: NOT DONE
- A9 Rate limit: NOT DONE
- A10 chat-service: PARTIAL (project existence already validated)
- B1 Single resolver: PARTIAL (ConfigService exists; sync/chat not fully unified)
- B2 ours source: PARTIAL (sync channels precedence done; chat not)
- B3-B8: NOT DONE
- C1-C7: NOT DONE (except sidebar label C? sidebar done)
