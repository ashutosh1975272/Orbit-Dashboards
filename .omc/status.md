# Status Ledger

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
- A5 Dashboard honesty: PARTIAL (duplicate banner removed, text changed; compact card not verified)
- A6 Jump to message: PARTIAL (metadata attached; SourceChip click not implemented)
- A7 LLM gating: PARTIAL (forced zero-new fixed; digest refresh not gated)
- A8 Reconnect: NOT DONE
- A9 Rate limit: NOT DONE
- A10 chat-service: PARTIAL (project existence already validated)
- B1 Single resolver: PARTIAL (ConfigService exists; sync/chat not fully unified)
- B2 ours source: PARTIAL (sync channels precedence done; chat not)
- B3-B8: NOT DONE
- C1-C7: NOT DONE (except sidebar label C? sidebar done)
