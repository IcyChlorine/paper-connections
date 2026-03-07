---
name: paper-connections-wt-sync
description: Resync Paper Connections session context after another worktree's changes are merged into the current worktree. Use when Codex needs to understand what landed from a worktree sync, reread workflow/docs such as `AGENTS.md`, inspect merged files and high-level features, rerun the repo build-check flow to catch post-merge issues, or when the user's message contains `wtsync`.
---

# Paper Connections WT Sync

Rebuild session context after a worktree-to-worktree sync. Focus on workflow and documentation changes first, then get only a brief grasp of merged feature work, and finish by rerunning the repo's build-check flow.

## Workflow

1. Confirm that the current task is a post-sync refresh.
   - Read `AGENTS.md` again before anything else.
   - Identify the current branch/worktree name so the session knows whether it is in the main worktree or a `wtN` worktree.
2. Inspect recent sync history.
   - Use the commands and checklist in [references/worktree-sync-checklist.md](references/worktree-sync-checklist.md).
   - Find the relevant recent merge commit or, if the sync was not recorded as a merge commit, inspect the recent commit range that brought the other worktree's changes in.
3. Review what changed with the right priority.
   - First review workflow/documentation changes, especially `AGENTS.md`, `.codex/skills/`, `doc/session-*.md`, `doc/current-features.md`, and `doc/storage-crud.md`.
   - Then skim the merged code and summarize newly landed functionality at a high level only. Do not spend most of the effort on feature archaeology.
4. Re-run repository verification.
   - Open `.codex/skills/paper-connections-build-check/SKILL.md` and follow it.
   - Treat this step as required after a worktree sync so the merged result is rebuilt and checked for integration breakage.
5. Report the resynced context compactly.
   - State which merge commit or commit range was inspected.
   - List the main changed files or areas.
   - Call out workflow/doc changes in more detail than feature changes.
   - Report the build-check result and whether a fresh `xpi` was produced.

## Scope

- Prioritize workflow, process, and documentation alignment over detailed feature deep-dives.
- If merged code touches `src/`, expect the build-check flow to rebuild with `.\make-zips.ps1`.
- If the merge history is messy, prefer a practical summary of what now matters for this session instead of a full forensic reconstruction.
