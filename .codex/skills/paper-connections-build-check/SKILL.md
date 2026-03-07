---
name: paper-connections-build-check
description: Validate Paper Connections repo changes before close-out. Use when Codex needs to run repo-specific verification after editing this Zotero plugin, especially for changes under `src`, packaging/build files, assets, bootstrap wiring, or docs that should stay in sync with behavior.
---

# Paper Connections Build Check

Verify changes from repo root and keep the check proportional to the diff.

## Workflow

1. Inspect the changed files first with `git status --short` and `git diff --name-only`.
2. Always run `git diff --check`.
3. Run `node --check` on changed `.js` files under `src` only when the source change is large.
   Treat the source change as large if any of these are true:
   - three or more `.js` files under `src` changed
   - a new `.js` file under `src` was added
   - the change clearly includes broad refactor/wiring work across modules, not just a small localized edit
4. If changed files include plugin runtime/package inputs, run `.\make-zips.ps1`.
   Runtime/package inputs include:
   - any file under `src/`
   - `make-zips.ps1`
   - `make-zips.sh`
   - `updates.json.tmpl`
   If any file under `src/` changed, treat this build as required, because the user may immediately install the refreshed `xpi` into Zotero for testing.
5. Use Git Bash build only as fallback when PowerShell build fails because of shell/tooling issues:
   `& 'C:\Program Files\Git\bin\bash.exe' ./make-zips.sh`
6. Review [references/repo-checklist.md](references/repo-checklist.md) for repo-specific invariants that the diff may have violated.
7. Report results compactly:
   - what was checked
   - what passed/failed
   - whether validation was full or partial
   - any follow-up fixes still required

## Repo Rules

- Treat CSS as non-JavaScript; do not try to run `node --check` on `.css`.
- Do not run `node --check` by default for a small localized JS edit.
- If the diff adds new plugin runtime files or assets, verify the packaging whitelist and script wiring, not just syntax/build success.
- If behavior changed, flag whether `doc/current-features.md` was updated.
- If data model/API changed, flag whether `doc/storage-crud.md` was updated.
- Prefer finding missing integration points over repeating long raw command output.

## Scope Control

- For doc-only changes outside build/package flow, `git diff --check` is the minimum default.
- For code changes in `src`, package build is required; add syntax checks only for large JS changes.
- Escalate to additional targeted inspection when the diff touches wiring-sensitive areas listed in the reference checklist.
