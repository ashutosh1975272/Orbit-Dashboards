# 02: Global Settings shell with the AI section inside

**Parent:** docs/superpowers/specs/2026-10-25-team-slack-and-global-settings-design.md

**What to build:** A **Global Settings** button sits beside **New project** in the dashboard toolbar and opens one
panel whose first section is the AI settings that today hide behind the toolbar's overflow menu. The user sets the
provider, the NVIDIA NIM model and the API key once, saves, and every card that has no override resolves through
them; a card that does override still wins, and the effective source (project / global / environment) is visible in
both places. The overflow-menu route to AI settings is gone, so there is exactly one way in.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The button is in the toolbar action group next to **New project**, uses the existing button styling, and opens
      the panel from anywhere on the dashboard.
- [ ] The panel's AI section edits the same global record the old menu item did — no new copy of the values, and
      nothing stored in the window.
- [ ] The API key field shows the stored mask, accepts a new value, and never sends the raw key to the renderer;
      length and provider validation reject bad input with a readable message.
- [ ] The model list still loads from the configured key, and an unconfigured key produces the existing
      "no key configured" state rather than a silent empty list.
- [ ] A card's AI section shows "Inherited from Global Settings" when it has no override, and its existing override
      switch keeps working unchanged.
- [ ] Service-level tests at the global settings seam cover: inheritance order per field, override wins, mask-only
      public view, and validation limits.
- [ ] `pnpm typecheck`, `pnpm vitest run` and `pnpm build` pass; the panel is opened and saved live in the Electron
      window and shown with a screenshot.
