---
name: paper-connections-session-summary
description: Update durable workflow/docs and write a new Paper Connections session summary for the current worktree. Use near session close-out when the user asks to summarize lessons learned, create a new session summary, or says `总结沉淀`.
---

# Paper Connections Session Summary

Close out a Paper Connections work session by updating durable docs only where needed and creating a fresh session summary for the current worktree.

## Workflow

1. Re-read `AGENTS.md` before editing docs.
2. Identify the current branch/worktree so the summary filename matches the current workspace.
3. Inspect current-session scope with small git checks such as `git status --short` and `git log --oneline --decorate -n 20`.
4. Update durable docs only when the session produced repeatable knowledge:
   - `AGENTS.md` for reusable workflow rules, skill triggers, or repeatable engineering lessons.
   - `doc/current-features.md` if user-visible behavior changed in this session and the file is not already current.
   - `doc/storage-crud.md` if data model or CRUD/API behavior changed.
5. Create a new session summary file by following [references/session-summary-checklist.md](references/session-summary-checklist.md).
6. Keep the summary compact and practical:
   - what changed in this session
   - important refinements/decisions
   - doc/workflow updates
   - validation/build results
   - key commits already created during the session, if any
7. If the session changed files under `src/`, open `.codex/skills/paper-connections-build-check/SKILL.md` and run that verification flow before close-out.

## Scope

- Prefer concise summaries over full chronological logs.
- Do not rewrite older session summaries; add a new one for the current session.
- Avoid touching docs that were unaffected by the session just to make them look uniform.
