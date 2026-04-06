---
phase: 21-global-skill-installation-cht-setup-claude-skills
verified: 2026-04-06T23:50:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 21: Global Skill Installation Verification Report

**Phase Goal:** Fix npm global installation so `npm install -g @kosoukhov/cht-cli && cht setup` works end-to-end: binary executes via tsup build pipeline, skills are copied to `~/.claude/skills/`, hooks registered, with doctor validation and old format migration
**Verified:** 2026-04-06T23:50:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                      | Status     | Evidence                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Running `cht setup` copies all 13 SKILL.md files to `~/.claude/skills/cht-*/` and registers hooks         | VERIFIED   | `copySkills()` in setup.ts:152-186 with fs.cp recursive; `registerHooks()` merges into settings.json; wired in bin/cht.ts:535-549; behavioral: `node dist/cht.js doctor` shows 13 skill + 4 hook checks all "ok" |
| 2   | Running `cht migrate` detects old `.claude/commands/cht/` format, removes it, and confirms cleanup         | VERIFIED   | `runMigrate()` in migrate.ts:12-51 checks global + project-local paths; wired in bin/cht.ts:563-571; behavioral: `node dist/cht.js migrate` returns `{"ok":true,"removed":[],"warnings":["No old...nothing to migrate"]}` |
| 3   | Running `cht doctor` reports green status when installed -- and specific failures otherwise                 | VERIFIED   | `runDoctor()` in doctor.ts:18-89 checks 13 skills, 4 hooks, CLI on PATH, storage; wired in bin/cht.ts:552-560; behavioral: `node dist/cht.js doctor` returns 19 checks all "ok"; test coverage for each failure mode in cht-doctor.test.ts |
| 4   | Running `cht setup` a second time completes without errors and without duplicating entries                  | VERIFIED   | registerHooks idempotency: test cht-setup.test.ts:68-90 (skips all 4 on second run, arrays length stays 1); copySkills idempotency: test cht-setup.test.ts:234-255 (overwrites with fs.cp force:true) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                         | Expected                                   | Status     | Details                                                                                 |
| -------------------------------- | ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------- |
| `tsup.config.ts`                 | Build config with defineConfig              | VERIFIED   | 14 lines, contains defineConfig, entry: ["bin/cht.ts"], format: ["esm"], banner with shebang |
| `dist/cht.js`                    | Bundled CLI binary with shebang             | VERIFIED   | 145.87 KB, line 1: `#!/usr/bin/env node`, no `experimental-strip-types`                  |
| `package.json`                   | bin -> dist/cht.js, files -> dist/ + skills | VERIFIED   | bin.cht = "dist/cht.js", files = ["dist/", ".claude/skills/"], scripts.build = "tsup", scripts.prepublishOnly = "npm run build", devDeps includes tsup |
| `src/hooks/setup.ts`             | copySkills() + resolvePackageRoot()         | VERIFIED   | 187 lines, exports registerHooks, cleanProjectHooks, resolvePackageRoot, copySkills      |
| `src/hooks/doctor.ts`            | runDoctor() + DoctorCheck interface         | VERIFIED   | 89 lines, exports DoctorCheck and runDoctor; checks 13 skills, 4 hooks, CLI, storage     |
| `src/hooks/migrate.ts`           | runMigrate() for old format cleanup         | VERIFIED   | 51 lines, exports runMigrate; handles global + project-local .claude/commands/cht/        |
| `bin/cht.ts`                     | CLI wiring for setup, doctor, migrate       | VERIFIED   | 587 lines, no shebang (starts with `import`), contains case "setup", "doctor", "migrate" |
| `tests/cli/cht-setup.test.ts`    | Tests for copySkills + registerHooks        | VERIFIED   | 270 lines, 4 describe blocks (registerHooks, cleanProjectHooks, resolvePackageRoot, copySkills) with 12 test cases |
| `tests/cli/cht-doctor.test.ts`   | Tests for all doctor checks                 | VERIFIED   | 131 lines, 5 test cases covering all-pass, missing skill, missing hooks, missing storage, overall fail |
| `tests/cli/cht-migrate.test.ts`  | Tests for migrate idempotency               | VERIFIED   | 65 lines, 4 test cases covering global removal, project removal, both missing, idempotency |

### Key Link Verification

| From                | To                         | Via                      | Status  | Details                                                     |
| ------------------- | -------------------------- | ------------------------ | ------- | ----------------------------------------------------------- |
| tsup.config.ts      | bin/cht.ts                 | entry field              | WIRED   | `entry: ["bin/cht.ts"]` in tsup.config.ts:4                 |
| package.json        | dist/cht.js                | bin field                | WIRED   | `"cht": "dist/cht.js"` in package.json:18                   |
| bin/cht.ts          | src/hooks/setup.ts         | import copySkills        | WIRED   | Import at line 30, used in case "setup" at line 536         |
| bin/cht.ts          | src/hooks/doctor.ts        | import runDoctor         | WIRED   | Import at line 31, used in case "doctor" at line 553        |
| bin/cht.ts          | src/hooks/migrate.ts       | import runMigrate        | WIRED   | Import at line 32, used in case "migrate" at line 564       |
| src/hooks/setup.ts  | .claude/skills/cht-*       | fs.cp recursive copy     | WIRED   | `fs.cp(src, dst, { recursive: true, force: true })` at line 178 |

### Behavioral Spot-Checks

| Behavior                                  | Command                            | Result                                                                                         | Status |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| Build produces dist/cht.js                | `npm run build`                    | dist/cht.js 145.87 KB, build success in 13ms                                                  | PASS   |
| Built binary shebang correct              | `head -1 dist/cht.js`             | `#!/usr/bin/env node`                                                                          | PASS   |
| No experimental-strip-types               | `grep experimental-strip-types dist/cht.js` | No matches (exit code 1)                                                                | PASS   |
| Doctor command returns JSON               | `node dist/cht.js doctor`         | JSON with 19 checks, all "ok", overall "ok"                                                    | PASS   |
| Migrate command returns JSON              | `node dist/cht.js migrate`        | `{"ok":true,"removed":[],"warnings":["No old .claude/commands/cht/ format found..."]}`         | PASS   |
| Full test suite passes                    | `npx vitest run`                  | 38 test files, 402 tests passed                                                                | PASS   |
| npm pack contains correct files           | `npm pack --dry-run`              | 17 files: dist/cht.js + 13 SKILL.md + package.json + LICENSE + README.md                       | PASS   |
| npm pack excludes source/tests            | `npm pack --dry-run \| grep src/`  | No matches -- no src/, bin/cht.ts, or tests/ leaked                                            | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                  | Status    | Evidence                                                                                     |
| ----------- | ---------- | -------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| SETUP-01    | 21-01, 21-02, 21-03 | `cht setup` copies 13 SKILL.md files and registers hooks                               | SATISFIED | copySkills() + registerHooks() in setup.ts, wired in bin/cht.ts case "setup", tested + behavioral spot-check |
| SETUP-02    | 21-02      | `cht migrate` detects old `.claude/commands/cht/` format and cleans up                       | SATISFIED | runMigrate() in migrate.ts, wired in bin/cht.ts case "migrate", 4 test cases                 |
| SETUP-03    | 21-02      | `cht doctor` validates installation: skills, hooks, CLI on PATH, storage                     | SATISFIED | runDoctor() in doctor.ts with 19 checks, wired in bin/cht.ts case "doctor", 5 test cases    |
| SETUP-04    | 21-02, 21-03 | Setup is idempotent -- safe to rerun                                                       | SATISFIED | registerHooks skips duplicates (tested), copySkills overwrites (tested), behavioral: second run no errors |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | No anti-patterns detected in any phase 21 artifacts |

### Human Verification Required

No human verification items. All truths verified programmatically via code inspection + behavioral spot-checks. The human verification in plan 21-03 was already completed and approved during execution (documented in 21-03-SUMMARY.md).

### Gaps Summary

No gaps found. All 4 roadmap success criteria verified. All 4 requirement IDs (SETUP-01 through SETUP-04) satisfied. All artifacts exist, are substantive, and are properly wired. Build pipeline produces correct output. Full test suite (402 tests) passes. npm pack contains exactly the expected files with no source/test leakage.

---

_Verified: 2026-04-06T23:50:00Z_
_Verifier: Claude (gsd-verifier)_
