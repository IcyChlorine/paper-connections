# Session Start Requirement (Mandatory)
- First read this file and provide exactly 5 bullet-point takeaways.
- Do not perform any code changes before finishing the 5-point summary.

# AGENTS Quick Notes (Read Every Session)

## Scope
- Target: Zotero 7 plugin in `src`.
- Current direction: paper connections plugin (not color demo behavior).
- Naming baseline: use `paper-connections` consistently (id, file names, build artifact names, update config keys).

## UI Terminology
- `Topic Context Section`: right item-pane custom section with context summary and create/remove topic actions.
- `Selection Debug Section`: right item-pane custom section showing selected node details for debug.
- `Relation Graph Workspace`: middle graph pane/canvas for core relation visualization and interactions.

## Development Docs Index (Read in Order)
- Session summary (latest): `doc/session-2026-03-05b-summary.md`.
- Current feature baseline: `doc/current-features.md`.
- Storage model + CRUD API: `doc/storage-crud.md`.
- Storage evaluation note (legacy filename): `assesment.md`.
- Early feasibility/background: `zotero-plugin-assessment.md`.
- Product/user docs: `README.md`.

## Doc Rules
- Before implementing any feature, read:
  1) `doc/current-features.md`
  2) `doc/storage-crud.md` (if data related)
  3) latest `doc/session-*.md`
- If behavior changes, update `doc/current-features.md` in the same task.
- If data model/API changes, update `doc/storage-crud.md` in the same task.

## Commit Rule
- Auto-commit stable milestone results.
- If progress is still uncertain, do not commit yet; commit after decisions are fixed.

## High-Value Lessons
- For item pane extension, use `Zotero.ItemPaneManager.registerSection()`. Do not manually append panes to parent layout.
- For custom item pane sections, always define both `header` and `sidenav` with valid `l10nID` and icons.
- For section UI that depends on external context, refresh section via explicit custom event + `onInit` listener.
- Keep `onRender` lightweight. Put heavy work in `onAsyncRender` if needed.
- Use `item.id` / `item.key` / `libraryID + itemKey` as stable identifiers; never use title as identity.
- For data writes, use Zotero APIs. Do not write Zotero SQLite directly.
- For relation graph storage, use `Zotero.SyncedSettings` with `loadAll(libraryID)` before `get/set`.
- Keep relation data topic-centered; use `itemTopicIndex` as reverse mapping.
- Main item drag payload uses `dataTransfer` type `zotero/item` (comma-separated itemIDs).
- For node labels, enforce wrapping/truncation and keep ASCII ellipsis (`...`) to avoid encoding issues in source files.
- If splitting plugin code into multiple scripts, load dependency sub-scripts in `bootstrap.js` before main script, and include all new files in the packaging whitelist used by `make-zips.sh` / `make-zips.ps1`.
- In PowerShell, prefer native build script: `.\make-zips.ps1`; Git Bash fallback: `& 'C:\\Program Files\\Git\\bin\\bash.exe' ./make-zips.sh`.
- For SVG canvas overlay controls, call a post-render position sync (for example via `requestAnimationFrame` + delayed retries) so top-right placement is correct on first mount before topic/context switches.
- For right-click gestures (for example Alt + RMB cut), explicitly handle `contextmenu` suppression and window-level key/mouse cleanup to prevent browser menu interference and stale interaction state.
- Keep canvas cursor fully state-driven: show grab/grabbing only when background panning is available; use default pointer on nodes and during cut gestures.
- For relation curves, keep drag-preview geometry and arrow semantics consistent with persisted edges, including backward-link routing with rightward tangents at both endpoints.
- When introducing new runtime SVG assets, add them under `src/assets` and verify `make-zips.sh` / `make-zips.ps1` whitelist includes them; otherwise controls may render as fallback blobs in packaged builds.
- For remark-driven node relayout, preserve node center and persist updated `x/y` for saved topics; otherwise topic reload on selection changes can cause subtle drift.
- When persisting node positions, make snap calculations use the currently displayed label metrics (for example via `snapLabel`) to avoid title/remark width mismatch offsets.
- If splitting mixins into new script files, update all three integration points together: `bootstrap.js` sub-script load order, `paper-connections.js` `Object.assign(...)`, and packaging whitelists in both `make-zips.sh` and `make-zips.ps1`.
- For graph context menus layered over SVG, close-on-outside-click should use both DOM containment checks and client-rect hit tests to avoid stale menus during overlay/input edge cases.

## Build and Packaging
- Build with `make-zips.sh` (Git Bash) or `make-zips.ps1` (PowerShell) from repo root.
- Both scripts use whitelist packaging for `src`; temp files inside `src` are not packaged.
- If shell permission issues occur in one shell, switch to the other script (`.\make-zips.ps1` or `& 'C:\\Program Files\\Git\\bin\\bash.exe' ./make-zips.sh`).

## Token/Time Saving
- Reuse local references first: `zotero-plugin-assessment.md` and local Zotero `app/omni.ja` API source.
- Avoid re-discovering DOM structure from screenshots repeatedly; use official extension APIs where possible.
- When renaming plugin identity, run a repo-wide search for old identifiers before build.
- Keep this file concise and update only with repeatable pitfalls and doc index changes.
