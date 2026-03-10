# Session Start Requirement (Mandatory)
- First read this file and provide exactly 5 bullet-point takeaways.
- Do not perform any code changes before finishing the 5-point summary.

# AGENTS Quick Notes (Read Every Session)

## Scope
- Target: Zotero 7 plugin in `src`.
- Current direction: paper connections plugin (not color demo behavior).
- Naming baseline: use `paper-connections` consistently (id, file names, build artifact names, update config keys).

## Worktree Development
- This repo may be developed through multiple `git worktree` workspaces in parallel; keep worktree-based collaboration in mind and prefer merge-friendly changes when that does not compromise the best implementation.
- Determine the current worktree identity from the branch name. No `wtN` suffix means the main worktree; `wt2`, `wt3`, etc. mean secondary worktrees.
- When recent progress may have been merged in from another worktree, inspect git merge history before starting or resuming work so you understand what already landed.

## UI Terminology
- `Topic Context Section`: right item-pane custom section with context summary and create/remove topic actions. Runtime id: `paper-connections-topic-context-section`.
- `Selection Debug Section`: right item-pane custom section showing selected node details for debug. Runtime id: `paper-connections-selection-debug-section`.
- `Relation Graph Workspace`: middle graph pane/canvas for core relation visualization and interactions. Core ids: `paper-connections-graph-pane`, `paper-connections-graph-canvas`.

## Persistent Docs
- Persistent docs are the repository files used to record development history and support future development.
- They include `AGENTS.md`, current documentation under `doc/`, and development history under `doc/devhist/`.

## Development Docs Index (Read in Order)
- Session summary (latest relevant summary for current worktree): `doc/devhist/session-*.md`.
- Current feature baseline: `doc/current-features.md`.
- Storage model + CRUD API: `doc/storage-crud.md`.
- Development history index: `doc/devhist/README.md`.
- Product/user docs: `README.md`.

## Project Skills
- Project-local skills live under `./.codex/skills/`.
- `paper-connections-build-check`: use after changes are made and before close-out, especially when `src` changed and a fresh `xpi` is needed for Zotero testing.
- Explicit trigger examples: `$paper-connections-build-check`, `use paper-connections-build-check`, `run build check`.
- `build-install-restart` script: `.\tools\build-install-restart.ps1 -ProfileName default|develop` is the current machine's primary dev-install workflow after functional changes that need Zotero verification.
- `paper-connections-zotero-screenshot`: use when the user explicitly asks for screenshots/UI verification or when window enumeration is itself the task; do not use it by default for normal close-out, because frontend/plugin testing is usually confirmed by the user manually.
- Explicit trigger examples: `$paper-connections-zotero-screenshot`, `use paper-connections-zotero-screenshot`, `capture zotero screenshot`.
- `paper-connections-wt-sync`: use after syncing another worktree into the current one so the session can rescan merge history, reread workflow/docs, and rerun the repo build-check flow.
- Explicit trigger examples: `$paper-connections-wt-sync`, `use paper-connections-wt-sync`, `wtsync`.
- `paper-connections-session-summary`: use near session close-out when Codex should update `AGENTS.md` or other docs with repeatable lessons and create a new session summary file for the current worktree session.
- Explicit trigger examples: `$paper-connections-session-summary`, `use paper-connections-session-summary`, `总结沉淀`.

## Doc Rules
- Before implementing any feature, read:
  1) `doc/current-features.md`
  2) `doc/storage-crud.md` (if data related)
  3) latest relevant `doc/devhist/session-*.md` for the current worktree; if recent merges brought in other worktree progress relevant to the task, also review those merged summaries
- If behavior changes, update `doc/current-features.md` in the same task.
- If data model/API changes, update `doc/storage-crud.md` in the same task.
- Session summary naming under worktree development is `session-yyyy-mm-dd-[session order:a-z][worktree suffix]-summary.md`, stored under `doc/devhist/`.
- Main worktree omits the worktree suffix. Example: `doc/devhist/session-2026-03-06a-summary.md`.
- Secondary worktrees include the suffix from the branch/worktree identity. Example: `doc/devhist/session-2026-03-05bwt2-summary.md`.
- If progress is synchronized between worktrees by merge, use git merge history to understand which updates came from other worktrees and avoid duplicating or overwriting summary content.

## Commit Rule
- Auto-commit stable milestone results.
- If progress is still uncertain, do not commit yet; commit after decisions are fixed.

## High-Value Lessons
- For item pane extension, use `Zotero.ItemPaneManager.registerSection()`. Do not manually append panes to parent layout.
- For custom item pane sections, always define both `header` and `sidenav` with valid `l10nID` and icons.
- For plugin preference panes, `Zotero.PreferencePanes.register()` `src` must be an XHTML fragment, not a full HTML document; prefer a XUL-root fragment (`vbox`, `groupbox`, native controls) and direct `preference` bindings for simple settings.
- For plugin preference panes inside Zotero Settings, rely on the host-provided pane title; do not duplicate the plugin title again inside the fragment.
- Settings helper copy should stay visually secondary (smaller font, lighter color, similar to VS Code setting hints).
- For this repo's settings pane UI, prefer Chinese user-facing copy unless a specific control should retain product branding in English.
- For settings that configure gestures or shortcuts, validate conflicts in the pane immediately and enforce the same constraint again in runtime pref handling.
- For plugin-controlled custom item-pane sections, prefer registering the section once and toggling visibility in `onItemChange` plus an item-pane refresh, rather than repeatedly register/unregister on pref flips.
- For section UI that depends on external context, refresh section via explicit custom event + `onInit` listener.
- Keep `onRender` lightweight. Put heavy work in `onAsyncRender` if needed.
- Use `item.id` / `item.key` / `libraryID + itemKey` as stable identifiers; never use title as identity.
- For data writes, use Zotero APIs. Do not write Zotero SQLite directly.
- For relation graph storage, use `Zotero.SyncedSettings` with `loadAll(libraryID)` before `get/set`.
- Zotero native related items are `dc:relation` style links and are not rich enough to serve as the primary typed graph-edge store.
- Keep relation data topic-centered; use `itemTopicIndex` as reverse mapping.
- Main item drag payload uses `dataTransfer` type `zotero/item` (comma-separated itemIDs).
- For node labels, enforce wrapping/truncation and keep ASCII ellipsis (`...`) to avoid encoding issues in source files.
- If splitting plugin code into multiple scripts, load dependency sub-scripts in `bootstrap.js` before main script, and include all new files in the packaging whitelist used by `make-zips.sh` / `make-zips.ps1`.
- In PowerShell, prefer native build script: `.\make-zips.ps1`; Git Bash fallback: `& 'C:\\Program Files\\Git\\bin\\bash.exe' ./make-zips.sh`.
- On Windows, avoid running `node --check` from a `\\?\`-prefixed working directory; use the normal drive path form or Node may fail with `EISDIR ... lstat 'C:'`.
- On this machine, prefer `.\tools\build-install-restart.ps1 -ProfileName default` as the end-to-end dev loop after functional changes; it builds, replaces the profile XPI, and restarts Zotero after confirmation.
- Before any script-driven Zotero shutdown/restart, explicitly obtain or confirm the user's consent for that run, because they may be testing another worktree or actively using Zotero.
- For SVG canvas overlay controls, call a post-render position sync (for example via `requestAnimationFrame` + delayed retries) so top-right placement is correct on first mount before topic/context switches.
- For right-click gestures (for example Alt + RMB cut), explicitly handle `contextmenu` suppression and window-level key/mouse cleanup to prevent browser menu interference and stale interaction state.
- Keep canvas cursor fully state-driven: show grab/grabbing only when background panning is available; use default pointer on nodes and during cut gestures.
- For relation curves, keep drag-preview geometry and arrow semantics consistent with persisted edges, including backward-link routing with rightward tangents at both endpoints.
- When introducing new runtime SVG assets, add them under `src/assets` and verify `make-zips.sh` / `make-zips.ps1` whitelist includes them; otherwise controls may render as fallback blobs in packaged builds.
- For add-on branding icons, declare packaged icon paths in `src/manifest.json` `icons` and keep the packaged asset under `src/assets`; a root-level `assets/` copy can exist as source artwork only.
- For remark-driven node relayout, preserve node center and persist updated `x/y` for saved topics; otherwise topic reload on selection changes can cause subtle drift.
- When persisting node positions, make snap calculations use the currently displayed label metrics (for example via `snapLabel`) to avoid title/remark width mismatch offsets.
- If splitting mixins into new script files, update all three integration points together: `bootstrap.js` sub-script load order, `paper-connections.js` `Object.assign(...)`, and packaging whitelists in both `make-zips.sh` and `make-zips.ps1`.
- For graph context menus layered over SVG, close-on-outside-click should use both DOM containment checks and client-rect hit tests to avoid stale menus during overlay/input edge cases.
- For graph workspace fullscreen, snapshot and restore the surrounding Zotero pane layout instead of forcing a fixed default, and preserve the same graph-space center point across the layout transition.

## Build and Packaging
- Build with `make-zips.sh` (Git Bash) or `make-zips.ps1` (PowerShell) from repo root.
- After any task that changes source files under `src`, default close-out flow is:
  1) run the repo build-check flow
  2) if the change is meant for immediate Zotero verification, run `.\tools\build-install-restart.ps1 -ProfileName default` after confirming the user wants Zotero closed/restarted
- Use restart-only flow `.\tools\restart-zotero-dev.ps1 -ProfileName default|develop` only when the user wants a relaunch without reinstalling the plugin XPI.
- Use `paper-connections-build-check` for the repo-specific close-out/build verification flow instead of restating the detailed checklist here.

## Token/Time Saving
- Reuse local references first: `doc/current-features.md`, `doc/storage-crud.md`, and local Zotero `app/omni.ja` API source.
- For README banner assets, prefer scripts that render the existing logo SVG plus title text with a small set of tunable layout parameters, rather than hand-redrawing the logo or hardcoding full-scene SVG markup.
- Avoid re-discovering DOM structure from screenshots repeatedly; use official extension APIs where possible.
- For Zotero UI screenshots on Windows, prefer the repo-local `paper-connections-zotero-screenshot` skill or its `tools/screenshot.py` wrapper, which matches `zotero.exe` windows by process tree instead of title text only.
- For Windows `PrintWindow` screenshot capture, enable process DPI awareness before reading window rects; otherwise 125%/150% display scaling can crop the right and bottom edges.
- When renaming plugin identity, run a repo-wide search for old identifiers before build.
- Keep this file concise and update only with repeatable pitfalls and doc index changes.
