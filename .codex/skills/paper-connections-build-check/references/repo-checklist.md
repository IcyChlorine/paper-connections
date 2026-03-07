# Repo Checklist

Use this checklist after determining the changed files.

## High-value checks

- `src` changed at all:
  - Run `.\make-zips.ps1` before close-out so the latest `build/paper-connections.xpi` is ready for Zotero testing.
- `src` JavaScript changed:
  - Run `node --check` on changed `.js` files only for large JS changes.
  - Treat the change as large if:
    - three or more `src/*.js` files changed
    - a new `src/*.js` file was added
    - the diff is a broad refactor or cross-module wiring change
  - If new runtime script files were added, verify all three integration points:
    - `src/bootstrap.js` sub-script load order
    - `src/paper-connections.js` `Object.assign(...)`
    - whitelist entries in both `make-zips.ps1` and `make-zips.sh`
- `src/assets` changed:
  - Verify the asset is still included by both build scripts.
  - If the asset is an add-on branding icon, verify `src/manifest.json` `icons`.
- `make-zips.ps1` or `make-zips.sh` changed:
  - Run `.\make-zips.ps1`.
  - Check output paths still match project conventions:
    - `build/paper-connections.xpi`
    - `build/updates.json`
- `updates.json.tmpl` changed:
  - Run package build and confirm `updates.json` regeneration still succeeds.

## Doc sync checks

- Behavior changed:
  - `doc/current-features.md` should usually change in the same task.
- Data model or storage API changed:
  - `doc/storage-crud.md` should usually change in the same task.
- Worktree summary is part of the task:
  - follow `AGENTS.md` summary naming rules
  - consider recent merge history if parallel worktrees were synchronized

## Reporting

Summarize validation in terms of:

- commands run
- pass/fail status
- repo-specific risks found
- any checks intentionally skipped
