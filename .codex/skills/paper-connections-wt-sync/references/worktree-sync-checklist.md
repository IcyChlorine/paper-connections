# Worktree Sync Checklist

Use this checklist after another worktree's progress is merged into the current one.

## 1. Identify the current worktree

- Run `git branch --show-current`.
- Infer worktree identity from the branch name.
- No `wtN` suffix means the main worktree. `wt2`, `wt3`, and similar suffixes mean secondary worktrees.

## 2. Find the incoming sync history

- Prefer recent merge history first:
  - `git log --merges --oneline --decorate -n 8`
  - `git log --oneline --decorate -n 12`
- If a merge commit is present, inspect it with:
  - `git show --stat --name-only <merge-commit>`
- If the sync was not recorded as a merge commit, inspect the recent commit range that was pulled in:
  - `git diff --name-only <older-commit>..<newer-commit>`
  - `git log --oneline --decorate <older-commit>..<newer-commit>`

## 3. Review changed files in priority order

Read these first if they changed:

- `AGENTS.md`
- `.codex/skills/`
- `doc/session-*.md`
- `doc/current-features.md`
- `doc/storage-crud.md`
- `README.md`

Then skim `src/` or build/package files to understand merged functionality at a high level only.

## 4. Capture the minimum useful context

Summarize:

- which merge commit or commit range was inspected
- which files or areas changed
- which workflow/doc rules changed
- which new features or fixes landed, briefly

Do not over-invest in detailed reverse engineering unless the current task depends on it.

## 5. Re-run verification

- Open `.codex/skills/paper-connections-build-check/SKILL.md`.
- Follow its repo-specific verification flow.
- If merged changes touch `src/`, expect `.\make-zips.ps1` to run so a fresh `xpi` is produced for Zotero testing.
