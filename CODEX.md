# CODEX Startup Notes (Read First)

## Current Goal
- Project base: Zotero official sample plugin `make-it-red`.
- Long-term goal: build a Zotero plugin for paper relation recording and visualization.
- Confirmed immediate task: change sample effect from "make text red" to "make text green", then build `.xpi`.

## Environment and Scope
- Current Zotero version: 7.
- Main source folder for Zotero 7 in this repo: `src-2.0`.
- Build tool from README: `make-zips` (run at repo root).

## Working Lessons
- Use collaborative mode: Codex handles code and scripts; user handles local GUI install/verification and shares logs/screenshots.
- For data operations, prefer Zotero API. Do not write Zotero SQLite DB directly.
- Use `libraryID + itemKey` as stable identifiers for relations to avoid title-change breakage.
- Build MVP first, then add compatibility and performance layers.
- Suggested first relation types: `cites | extends | contradicts | related`.

## Collaboration Rules
- On every new session, read this file and `zotero-plugin-assessment.md` first.
- After changes, provide directly testable outputs: artifact paths, validation steps, known limits.
- If work needs system paths, real Zotero profile access, or GUI interaction, clearly mark which steps the user must run locally.
