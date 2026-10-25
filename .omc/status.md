# Status Ledger

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
