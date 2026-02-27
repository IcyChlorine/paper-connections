# Session Start Requirement (Mandatory)
- First read this file and provide exactly 5 bullet-point takeaways.
- Do not perform any code changes before finishing the 5-point summary.

# AGENTS Quick Notes (Read Every Session)

## Scope
- Target: Zotero 7 plugin in `src`.
- Current direction: paper relations plugin (not color demo behavior).
- Naming baseline: use `paper-relations` consistently (id, file names, build artifact names, update config keys).

## UI Terminology
- `Topic Context Section`: right item-pane custom section with context summary and create/remove topic actions.
- `Selection Debug Section`: right item-pane custom section showing selected node details for debug.
- `Relation Graph Workspace`: middle graph pane/canvas for core relation visualization and interactions.

## Development Docs Index (Read in Order)
- Session summary (latest): `doc/session-2026-02-27a-summary.md`.
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

## Build and Packaging
- Build with `make-zips` from repo root.
- `make-zips` uses whitelist packaging for `src`; temp files inside `src` are not packaged.
- If shell permission issues occur on Windows sandbox, run `C:\\Program Files\\Git\\bin\\bash.exe ./make-zips`.

## Token/Time Saving
- Reuse local references first: `zotero-plugin-assessment.md` and local Zotero `app/omni.ja` API source.
- Avoid re-discovering DOM structure from screenshots repeatedly; use official extension APIs where possible.
- When renaming plugin identity, run a repo-wide search for old identifiers before build.
- Keep this file concise and update only with repeatable pitfalls and doc index changes.
