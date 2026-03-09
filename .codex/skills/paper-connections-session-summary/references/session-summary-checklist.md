# Session Summary Checklist

## Worktree Identity

- Read the current branch name first.
- Main worktree summaries omit a worktree suffix: `doc/devhist/session-YYYY-MM-DDa-summary.md`.
- Secondary worktrees include the branch suffix immediately before `-summary`: `doc/devhist/session-YYYY-MM-DDawt2-summary.md`.
- Keep the session order letter local to that date and worktree.

## Session Scope Scan

- Check `git status --short`.
- Check recent commits with `git log --oneline --decorate -n 20`.
- If another worktree was recently merged in, separate "merged context now present" from "new work done in this session".

## Summary Structure

- Title with the session date/worktree.
- Short sections covering:
  - major feature work or refinements
  - workflow/doc updates
  - verification/build results
  - commits already created during the session

## Doc Sync Reminders

- Update `AGENTS.md` only for repeatable lessons, skill triggers, or doc-index maintenance.
- Update `doc/current-features.md` if the session changed user-visible behavior and that file has not already been brought current.
- Update `doc/storage-crud.md` only for real storage or API changes.
- Keep the summary focused on what future sessions need to know, not on every experiment that happened along the way.
