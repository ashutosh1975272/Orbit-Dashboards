# Status Ledger

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
