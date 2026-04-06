---
phase: 21-global-skill-installation-cht-setup-claude-skills
plan: 02
subsystem: cli
tags: [skills, hooks, doctor, migrate, idempotent, fs-copy]

# Dependency graph
requires:
  - phase: 21-01
    provides: 13 SKILL.md files in .claude/skills/cht-* and package.json includes .claude/skills/
provides:
  - copySkills() copies 13 skill directories from package to ~/.claude/skills/
  - runDoctor() validates installation (skills, hooks, CLI, storage)
  - runMigrate() removes old .claude/commands/cht/ format
  - Extended cht setup command (skills + hooks + cleanup in one command)
  - cht doctor and cht migrate CLI subcommands
affects: [21-03, distribution, npm-publish]

# Tech tracking
tech-stack:
  added: []
  patterns: [idempotent-overwrite, doctor-checks-pattern, migration-pattern]

key-files:
  created:
    - src/hooks/doctor.ts
    - src/hooks/migrate.ts
    - tests/cli/cht-doctor.test.ts
    - tests/cli/cht-migrate.test.ts
  modified:
    - src/hooks/setup.ts
    - bin/cht.ts
    - tests/cli/cht-setup.test.ts

key-decisions:
  - "copySkills overwrites all on every run (D-06) -- simple idempotent strategy"
  - "resolvePackageRoot uses import.meta.dirname parent (D-07) -- works for both dist/ and bin/"
  - "Doctor skipCliCheck option for testability -- avoids flaky which(1) calls in CI"

patterns-established:
  - "Overwrite-all idempotency: fs.cp with force:true, no diffing"
  - "Doctor check pattern: array of {name, status, detail} with overall pass/fail"
  - "Migration pattern: stat->isDirectory->rm for safe old-format cleanup"

requirements-completed: [SETUP-01, SETUP-02, SETUP-03, SETUP-04]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 21 Plan 02: Setup/Doctor/Migrate Summary

**Three idempotent CLI commands: `cht setup` copies 13 skills + registers hooks, `cht doctor` validates installation, `cht migrate` removes old command format**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T15:24:35Z
- **Completed:** 2026-04-06T15:29:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Implemented `copySkills()` that copies 13 cht-* skill directories from package to ~/.claude/skills/ with overwrite idempotency
- Extended `cht setup` to run copySkills + registerHooks + cleanProjectHooks in one command
- Created `cht doctor` with 18 checks: 13 skills, 4 hooks, CLI on PATH, storage accessibility
- Created `cht migrate` to detect and remove old .claude/commands/cht/ directories (global + project-local)
- All commands are fully idempotent and safe to rerun
- 21 tests pass in setup/doctor/migrate test files, 402 total tests pass

## Task Commits

Each task was committed atomically (TDD: red then green):

1. **Task 1: Implement copySkills() and extend cht setup**
   - `5ca1e37` (test: failing tests for copySkills/resolvePackageRoot)
   - `8e51bb2` (feat: implement copySkills, extend setup command)
2. **Task 2: Implement cht doctor and cht migrate commands**
   - `c8a26a2` (test: failing tests for doctor and migrate)
   - `1984276` (feat: implement doctor and migrate commands)

## Files Created/Modified
- `src/hooks/setup.ts` - Added resolvePackageRoot() and copySkills() exports
- `src/hooks/doctor.ts` - New: runDoctor() with DoctorCheck interface, validates 13 skills + 4 hooks + CLI + storage
- `src/hooks/migrate.ts` - New: runMigrate() removes old .claude/commands/cht/ from global and project locations
- `bin/cht.ts` - Added copySkills import, doctor/migrate cases, updated setup case and available commands list
- `tests/cli/cht-setup.test.ts` - Extended with 5 new tests for copySkills and resolvePackageRoot
- `tests/cli/cht-doctor.test.ts` - New: 5 test cases covering all doctor check scenarios
- `tests/cli/cht-migrate.test.ts` - New: 4 test cases covering migrate with idempotency

## Decisions Made
- copySkills overwrites all files on every run rather than diffing -- matches GSD installer pattern (D-06)
- resolvePackageRoot takes import.meta.dirname as parameter rather than accessing it directly -- enables testing (D-07)
- Doctor's skipCliCheck option prevents `which cht` from causing test flakiness in CI environments
- Fixed test for "source not found" by using isolated temp directory instead of subdirectory of source

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test for missing source directory**
- **Found during:** Task 1 (copySkills implementation)
- **Issue:** Plan's test used `path.join(tmpSource, "nonexistent")` as metaDirname, but resolvePackageRoot goes up to tmpSource which has .claude/skills/
- **Fix:** Used separate isolated temp directory with no .claude/skills/ at all
- **Files modified:** tests/cli/cht-setup.test.ts
- **Verification:** Test correctly validates error path
- **Committed in:** 8e51bb2 (Task 1 green commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test design)
**Impact on plan:** Minor test fix for correct behavior validation. No scope creep.

## Issues Encountered
- Build required `npm install` first since worktree had no node_modules -- resolved by running install before build

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three distribution commands implemented and tested
- Plan 21-03 (integration verification) can validate end-to-end flow
- `cht setup` is now a complete one-command installation
- `cht doctor` provides specific failure messages for troubleshooting

---
*Phase: 21-global-skill-installation-cht-setup-claude-skills*
*Completed: 2026-04-06*
