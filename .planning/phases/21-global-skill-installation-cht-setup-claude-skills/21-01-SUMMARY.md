---
phase: 21-global-skill-installation-cht-setup-claude-skills
plan: 01
subsystem: infra
tags: [tsup, esbuild, build-pipeline, npm-publish, cli]

# Dependency graph
requires: []
provides:
  - "tsup build pipeline producing dist/cht.js from bin/cht.ts"
  - "package.json bin pointing to dist/cht.js (not source)"
  - "prepublishOnly script ensuring build before publish"
affects: [21-02, 21-03]

# Tech tracking
tech-stack:
  added: [tsup]
  patterns: [esm-bundle-with-shebang-banner, single-file-cli-output]

key-files:
  created: [tsup.config.ts]
  modified: [package.json, package-lock.json, bin/cht.ts]

key-decisions:
  - "tsup banner config for shebang injection instead of post-build script"
  - "splitting: false for single output file (import.meta.dirname compatibility)"

patterns-established:
  - "Build pipeline: tsup bundles bin/cht.ts -> dist/cht.js with ESM format, node22 target"
  - "Shebang via banner config, not in source files"

requirements-completed: [SETUP-01]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 21 Plan 01: Build Pipeline Summary

**tsup build pipeline producing dist/cht.js with correct shebang, replacing broken --experimental-strip-types direct execution**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T15:18:54Z
- **Completed:** 2026-04-06T15:21:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- tsup build pipeline installed and configured, producing single dist/cht.js from bin/cht.ts + all src/
- Removed broken --experimental-strip-types shebang from source; tsup injects correct #!/usr/bin/env node via banner
- package.json updated: bin points to dist/cht.js, files ships only dist/ and .claude/skills/, prepublishOnly ensures build before publish
- All 388 existing tests pass unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tsup and create build configuration** - `44fbffd` (feat)
2. **Task 2: Remove source shebang and verify built binary executes** - `db14927` (fix)

## Files Created/Modified
- `tsup.config.ts` - Build configuration: ESM format, node22 target, shebang banner, single output
- `package.json` - bin -> dist/cht.js, files -> [dist/, .claude/skills/], added build + prepublishOnly scripts, tsup devDep
- `package-lock.json` - Lock file updated with tsup dependency tree
- `bin/cht.ts` - Removed #!/usr/bin/env node --experimental-strip-types shebang line

## Decisions Made
- Used tsup `banner` config to inject shebang instead of a post-build sed script -- cleaner, declarative, portable
- Set `splitting: false` to ensure single output file -- import.meta.dirname resolves correctly in single-file bundle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new security surface introduced.

## Next Phase Readiness
- dist/cht.js builds and executes correctly, ready for `cht setup` / `cht doctor` / `cht migrate` commands (plans 02 and 03)
- prepublishOnly ensures npm publish always ships a fresh build

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 21-global-skill-installation-cht-setup-claude-skills*
*Completed: 2026-04-06*
