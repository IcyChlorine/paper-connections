# Session Start Requirement (Mandatory)
- First read this file and provide exactly 5 bullet-point takeaways.
- Do not perform any code changes before finishing the 5-point summary.

# AGENTS Quick Notes (Read Every Session)

## Scope
- Target: Zotero 7 plugin in `src-2.0`.
- Current direction: paper relations plugin (not color demo behavior).
- Naming baseline: use `paper-relations` consistently (id, file names, build artifact names, update config keys).

## Docs
- Feature record: `doc/current-features.md`.
- Before implementing new features, read the feature record to avoid duplicate work.

## Commit Rule
- Auto-commit stable milestone results.
- If progress is still uncertain, do not commit yet; commit after decisions are fixed.

## High-Value Lessons
- For item pane extension, use `Zotero.ItemPaneManager.registerSection()`. Do not manually append panes to parent layout.
- For custom item pane sections, always define both `header` and `sidenav` with valid `l10nID` and icons.
- Keep `onRender` lightweight. Put heavy work in `onAsyncRender` if needed.
- Use `item.id` / `item.key` / `libraryID + itemKey` as stable identifiers; never use title as identity.
- For data writes, use Zotero APIs. Do not write Zotero SQLite directly.

## Build and Packaging
- Build with `make-zips` from repo root.
- `make-zips` uses whitelist packaging for `src-2.0`; temp files inside `src-2.0` are not packaged.
- If shell permission issues occur on Windows sandbox, run `C:\\Program Files\\Git\\bin\\bash.exe ./make-zips`.

## Token/Time Saving
- Reuse local references first: `zotero-plugin-assessment.md` and local Zotero `app/omni.ja` API source.
- Avoid re-discovering DOM structure from screenshots repeatedly; use official extension APIs where possible.
- When renaming plugin identity, run a repo-wide search for old identifiers before build.
- Keep this file concise and update only with repeatable pitfalls.
