# Audit P0/Correctness Fix Plan

## Decisions
- LLM gating: daily re-check only if user enables (default OFF). Store flag in app settings? Use env/dashboard setting. Default false.
- Waiting count definition: needs-reply items + blockers owned by us + risks. "Oldest waiting age" = max age among needs-reply (using last client message whenIso) and blockers (sinceIso).
- Progress jump threshold: 25 points (configurable via env ORBIT_PROGRESS_JUMP_THRESHOLD, default 25). Reject without evidence.
- Fab missing dates/whenIso/quoteIsReal -> null/false.

## Items
1 Logging: already partial. Move audit tests into default suite (vitest config include).
2 Encryption: block save when unavailable; migrate legacy plaintext.
3 Prompt injection: locked system prompt + code guard.
4 Fabrication: null/false.
5 Dashboard honesty: "—" / "Not enough info"; remove duplicate banner.
6 Jump to message: already metadata; add scroll+flash in SourceChip; oldest age.
7 LLM gating: default OFF daily re-check; digest refresh only on insight change.
8 Reconnect: setStatus calls.
9 Rate limit: per-token queue.
10 chat-service validation.
