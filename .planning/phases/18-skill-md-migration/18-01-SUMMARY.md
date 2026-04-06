---
phase: 18-skill-md-migration
plan: 01
subsystem: skills
tags: [skill-md, frontmatter, cli, migration, auto-invocation]

# Dependency graph
requires:
  - phase: 17-hook-subcommands
    provides: "CLI binary (cht) and hook infrastructure"
provides:
  - "13 SKILL.md files in skills/cht-*/SKILL.md format"
  - "13 command test files covering new SKILL.md format"
  - "6 enriched descriptions for auto-invocation"
  - "3 skills with Read in allowed-tools"
affects: [18-02-cleanup, 19-setup-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SKILL.md frontmatter with name/description/allowed-tools", "YAML list format for multi-tool allowed-tools", "enriched description for auto-invocation triggers"]

key-files:
  created:
    - skills/cht-new/SKILL.md
    - skills/cht-end/SKILL.md
    - skills/cht-search/SKILL.md
    - skills/cht-continue/SKILL.md
    - skills/cht-include/SKILL.md
    - skills/cht-list/SKILL.md
    - skills/cht-status/SKILL.md
    - skills/cht-delete/SKILL.md
    - skills/cht-archive/SKILL.md
    - skills/cht-restore/SKILL.md
    - skills/cht-rename/SKILL.md
    - skills/cht-tag/SKILL.md
    - skills/cht-rollover/SKILL.md
    - tests/commands/new.test.ts
    - tests/commands/search.test.ts
    - tests/commands/list.test.ts
    - tests/commands/status.test.ts
    - tests/commands/end.test.ts
    - tests/commands/rollover.test.ts
  modified:
    - tests/commands/archive.test.ts
    - tests/commands/continue.test.ts
    - tests/commands/delete.test.ts
    - tests/commands/include.test.ts
    - tests/commands/rename.test.ts
    - tests/commands/restore.test.ts
    - tests/commands/tag.test.ts

key-decisions:
  - "YAML list format for multi-tool allowed-tools (continue, include, rollover) per research recommendation"
  - "Dropped Bash(wc *) from continue/include/rollover -- Read tool sufficient for line estimation"
  - "Enriched descriptions use frontmatter description field for auto-invocation triggers (6 skills)"

patterns-established:
  - "SKILL.md format: name, description, allowed-tools frontmatter with body instructions using cht CLI"
  - "Cross-reference syntax: /cht-command (hyphen, not colon)"
  - "YAML list for allowed-tools when skill needs multiple tools"

requirements-completed: [SKILL-01, SKILL-02, SKILL-03, SKILL-04]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 18 Plan 01: Create SKILL.md Files Summary

**13 SKILL.md files with enriched auto-invocation descriptions, differentiated allowed-tools, and 117 passing tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T07:48:49Z
- **Completed:** 2026-04-06T07:54:09Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Created all 13 `skills/cht-*/SKILL.md` files with correct frontmatter (name, description, allowed-tools)
- 6 key skills enriched with auto-invocation trigger descriptions (new, search, continue, include, list, status)
- 3 skills (continue, include, rollover) have Read in allowed-tools with YAML list format
- Updated 7 existing tests + created 6 new tests, all 117 tests passing
- Zero occurrences of old `node --experimental-strip-types` CLI invocation in skills/
- Zero occurrences of old `/cht:` colon syntax in skills/

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 13 skills/cht-*/SKILL.md files from source commands** - `ec11977` (feat)
2. **Task 2: Update 7 existing + create 6 new command test files** - `e7511b8` (test)

## Files Created/Modified
- `skills/cht-new/SKILL.md` - New chat skill with enriched auto-invocation description
- `skills/cht-end/SKILL.md` - End chat session skill
- `skills/cht-search/SKILL.md` - Search skill with enriched description
- `skills/cht-continue/SKILL.md` - Continue skill with Read tool and enriched description
- `skills/cht-include/SKILL.md` - Include context skill with Read tool and enriched description
- `skills/cht-list/SKILL.md` - List skill with enriched description
- `skills/cht-status/SKILL.md` - Status skill with enriched description
- `skills/cht-delete/SKILL.md` - Delete chat skill
- `skills/cht-archive/SKILL.md` - Archive chat skill
- `skills/cht-restore/SKILL.md` - Restore archived chat skill
- `skills/cht-rename/SKILL.md` - Rename chat skill
- `skills/cht-tag/SKILL.md` - Tag management skill
- `skills/cht-rollover/SKILL.md` - Rollover skill with Read tool
- `tests/commands/new.test.ts` - New test (7 assertions)
- `tests/commands/search.test.ts` - New test (7 assertions)
- `tests/commands/list.test.ts` - New test (7 assertions)
- `tests/commands/status.test.ts` - New test (6 assertions)
- `tests/commands/end.test.ts` - New test (7 assertions)
- `tests/commands/rollover.test.ts` - New test (8 assertions)
- `tests/commands/archive.test.ts` - Updated: path, describe, allowed-tools, body assertions
- `tests/commands/continue.test.ts` - Updated: path, describe, removed Bash(wc) assertion
- `tests/commands/delete.test.ts` - Updated: path, describe, allowed-tools, body assertions
- `tests/commands/include.test.ts` - Updated: path, describe, removed wc assertions
- `tests/commands/rename.test.ts` - Updated: path, describe, allowed-tools, body assertions
- `tests/commands/restore.test.ts` - Updated: path, describe, allowed-tools, body assertions
- `tests/commands/tag.test.ts` - Updated: path, describe, allowed-tools, cross-ref assertions

## Decisions Made
- Used YAML list format for multi-tool allowed-tools (continue, include, rollover) for clarity and parseability
- Dropped `Bash(wc *)` from continue/include/rollover per D-07 minimal privileges -- Read tool can estimate line count
- Updated include/rollover body to use Read-based line estimation instead of `wc -l` shell command

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 13 SKILL.md files ready for Plan 02 (cleanup: delete old commands, update package.json, update bin/cht.ts, update README.md)
- Old `.claude/commands/cht/*.md` files still exist (Plan 02 deletes them)
- `bin/cht.ts` still has 4 `/cht:` references (Plan 02 updates them)
- `README.md` still has ~39 `/cht:` references (Plan 02 updates them)

## Self-Check: PASSED

All 19 created files verified present. Both task commits (ec11977, e7511b8) verified in git log. 117 tests pass across 13 test files. Zero old patterns in skills directory.

---
*Phase: 18-skill-md-migration*
*Completed: 2026-04-06*
