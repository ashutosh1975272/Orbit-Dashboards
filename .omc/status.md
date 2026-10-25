# Status Ledger

## Baseline (2026-10-25)
- typecheck: clean
- lint: 26 errors, 945 warnings
- tests: 267 passed, 28 failed (9 files)
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
