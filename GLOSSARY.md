# GLOSSARY.md — shared language (dashboard feature)

| Term | Meaning |
|---|---|
| **Project** | A card unit on the dashboard. Named by the user for one client project. Contains one or more Watched Channels. Synonym in code: `DashboardProject`. |
| **Watched Channel** | A Slack channel / private group / group DM that belongs to a Project and is polled by the Sync Engine. |
| **Monitor** | The stored instruction "sync this profile+workspace+channel for this project". |
| **Delta Cursor** | The Slack `ts` of the newest stored message of a Watched Channel. A sync fetches only messages with `ts > cursor` (newer → greater). |
| **Delta Store** | Local JSON storage of all synced messages, one file per channel, under `<userData>/dashboard/`. Never leaves the machine. |
| **Sync Engine** | Main-process module that, on a 5-minute timer or an explicit request, polls every Monitor and appends new messages to the Delta Store. |
| **Manual Sync** | A user-triggered sync (card button / dashboard-wide button). Reuses the same engine on demand. |
| **Token Source** | Where a workspace token comes from: `oauth` (existing TokenStore, connected in-app) or `manual` (pasted xoxp token, stored in `.env_dashboard` / secrets panel). |
| **Snapshot** | The IPC payload the renderer draws cards from: projects, summaries, completion, mood, dates, last-updated. |
| **Completion** | 0–100 progress of a Project: manual value if set, else `autoCompletion` estimated from message activity/recency. Manual value wins when both exist. |
| **Mood Signal** | Local keyword/emoji heuristic over recent project messages → `good / neutral / tense`. No external AI calls in Phase 1. |
| **Extracted Dates** | Start/deadline dates found by date-pattern heuristics in messages. Manual project dates (if set) win over extracted. |
| **Secrets Panel** | Bottom-of-sidebar settings surface for adding manual tokens and creating/editing Projects (pick workspace + Watched Channels). |
| **Dashboard Mode** | Renderer view state where the embedded Slack view is hidden and the card list is shown. |
