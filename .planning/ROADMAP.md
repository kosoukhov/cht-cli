# Roadmap: Chat CLI

## Milestones

- [x] **v1.0 MVP** -- Phases 1-3 ([archived](milestones/v1.0-ROADMAP.md), shipped 2026-03-23)
- [x] **v1.1 UX & Management** -- Phases 4-7 ([archived](milestones/v1.1-ROADMAP.md), shipped 2026-03-24)
- [x] **v2.0 Skills Architecture Pivot** -- Phases 8-12 ([archived](milestones/v2.0-ROADMAP.md), shipped 2026-03-28)
- [x] **v2.1 Reliability & Context Management** -- Phases 13-16 ([archived](milestones/v2.1-ROADMAP.md), shipped 2026-03-31)
- [ ] **v2.2 Skills Format Migration** -- Phases 17-21 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) -- SHIPPED 2026-03-23</summary>

- [x] **Phase 1: Storage Foundation** -- Schemas, markdown parser, atomic writes, chat CRUD
- [x] **Phase 2: Chat Loop** -- Streaming client, file attachments, REPL with commands
- [x] **Phase 3: Context & Discovery** -- Token tracking, summarization, search, /include

</details>

<details>
<summary>v1.1 UX & Management (Phases 4-7) -- SHIPPED 2026-03-24</summary>

- [x] **Phase 4: Schema & Chat Management** (3/3 plans) -- Delete, archive, restore, rename, --recent N
- [x] **Phase 5: Model Selection & Switching** (2/2 plans) -- --model flag, /model command, alias resolution
- [x] **Phase 6: Tags System** (3/3 plans) -- /tag add/remove, /tags, --tag filter, inline display
- [x] **Phase 7: Fuzzy Search & Attachment Polish** (2/2 plans) -- fuse.js fuzzy search, drag-and-drop paths, multi-file paste

</details>

<details>
<summary>v2.0 Skills Architecture Pivot (Phases 8-12) -- SHIPPED 2026-03-28</summary>

- [x] **Phase 8: Foundation** (3/3 plans) -- Clean dead code, session state, CLI entrypoint
- [x] **Phase 9: Read-Only Skills** (2/2 plans) -- /cht:list, /cht:search verified end-to-end
- [x] **Phase 10: Core Persistence** (2/2 plans) -- Hook-driven message capture, /cht:new, /cht:end
- [x] **Phase 11: Continuation + Context** (3/3 plans) -- /cht:continue, /cht:include with auto-summarization
- [x] **Phase 12: Management + Tags** (3/3 plans) -- delete/archive/restore/rename, /cht:tag, inline display

</details>

<details>
<summary>v2.1 Reliability & Context Management (Phases 13-16) -- SHIPPED 2026-03-31</summary>

- [x] **Phase 13: Persistence Reliability** (2/2 plans) -- completed 2026-03-30
- [x] **Phase 14: Context Awareness** (1/1 plan) -- completed 2026-03-30
- [x] **Phase 15: Chat Rollover** (2/2 plans) -- completed 2026-03-31
- [x] **Phase 16: Compact Integration** (2/2 plans) -- completed 2026-03-31

</details>

### v2.2 Skills Format Migration (In Progress)

**Milestone Goal:** Migrate 13 cht-skills to user-global `~/.claude/skills/cht-*/SKILL.md` format with `/cht-command` syntax, CLI-based hooks, and one-command setup.

- [x] **Phase 17: Hook Subcommands** -- CLI hook commands replacing TypeScript hook scripts (completed 2026-04-04)
- [x] **Phase 18: SKILL.md Migration** -- 13 skills converted to new format with updated syntax (completed 2026-04-06)
- [x] **Phase 19: Setup & Distribution** -- Merged into Phase 21
- [ ] **Phase 20: Documentation & Publish** -- README, migration guide, npm publish


## Phase Details

### Phase 17: Hook Subcommands
**Goal**: Hooks work as CLI subcommands so they can be called from user-global `~/.claude/settings.json` without project-local paths
**Depends on**: Phase 16 (v2.1 complete)
**Requirements**: HOOK-01, HOOK-02, HOOK-03
**Success Criteria** (what must be TRUE):
  1. Running `cht hook-save-user` with valid stdin JSON appends user message to the active chat file
  2. Running `cht hook-save-assistant` / `cht hook-save-compact` with valid stdin JSON appends the corresponding message to the active chat file
  3. Hook entries in `~/.claude/settings.json` reference the `cht` binary (not relative paths) and fire on UserPromptSubmit, Stop, PostCompact, and SessionEnd events
  4. Running `cht setup` twice does not create duplicate hook entries in settings.json
**Plans**: 2 plans
Plans:
- [x] 17-01-PLAN.md -- Shared stdin utility + 4 hook-* subcommands + integration tests
- [x] 17-02-PLAN.md -- Setup command with settings.json merge, idempotency, project-local cleanup

### Phase 18: SKILL.md Migration
**Goal**: All 13 chat commands are available as user-global skills invokable via `/cht-command` from any project directory
**Depends on**: Phase 17
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04
**Success Criteria** (what must be TRUE):
  1. Each of the 13 skills exists as `skills/cht-*/SKILL.md` in the repo with correct frontmatter (name, description, allowed-tools)
  2. Invoking `/cht-new`, `/cht-search`, `/cht-continue` (and all other commands) triggers the correct behavior via the `cht` CLI binary on PATH
  3. All cross-references between skills use `/cht-command` hyphen syntax -- zero occurrences of `/cht:command` remain
  4. Context-relevant skills (e.g., `/cht-search`) include description text that enables auto-invocation when users ask related questions
**Plans**: 2 plans
Plans:
- [x] 18-01-PLAN.md -- Create 13 skills/cht-*/SKILL.md files + update and create all 13 command tests
- [x] 18-02-PLAN.md -- Cross-reference updates (CLI, tests, README, package.json), delete old commands, human verify

### Phase 19: Setup & Distribution (Merged into Phase 21)
**Goal**: Absorbed by Phase 21 per D-12. All SETUP-01 through SETUP-04 requirements are delivered in Phase 21.
**Status**: Merged

### Phase 20: Documentation & Publish
**Goal**: New and upgrading users have clear instructions to install, use, and migrate to the new skills format
**Depends on**: Phase 21
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. README shows `/cht-command` syntax throughout, with updated installation instructions referencing `cht setup`
  2. A migration guide section provides step-by-step instructions for users upgrading from v2.1 (old colon syntax to new hyphen syntax)
  3. End-to-end validation passes: fresh `npm install -g @kosoukhov/cht-cli && cht setup` followed by `/cht-new` in a random project directory creates a chat with message persistence
**Plans**: TBD

### Phase 21: Global Skill Installation — cht setup + build pipeline
**Goal**: Fix npm global installation so `npm install -g @kosoukhov/cht-cli && cht setup` works end-to-end: binary executes via tsup build pipeline, skills are copied to `~/.claude/skills/`, hooks registered, with doctor validation and old format migration
**Depends on**: Phase 18
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (what must be TRUE):
  1. Running `cht setup` copies all 13 SKILL.md files to `~/.claude/skills/cht-*/` and registers hooks in `~/.claude/settings.json`
  2. Running `cht migrate` detects old `.claude/commands/cht/` format, removes it, and confirms cleanup
  3. Running `cht doctor` reports green status when skills are present, hooks registered, CLI on PATH, and storage accessible -- and reports specific failures otherwise
  4. Running `cht setup` a second time completes without errors and without duplicating any entries
**Plans**: 3 plans
Plans:
- [x] 21-01-PLAN.md -- tsup build pipeline: config, package.json updates, shebang fix
- [x] 21-02-PLAN.md -- Setup skill copy, doctor validation, migrate old format + tests
- [x] 21-03-PLAN.md -- Integration verification: npm pack, built binary, human sign-off

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 18 -> 21 -> 20

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Storage Foundation | v1.0 | 3/3 | Complete | 2026-03-23 |
| 2. Chat Loop | v1.0 | 3/3 | Complete | 2026-03-23 |
| 3. Context & Discovery | v1.0 | 3/3 | Complete | 2026-03-23 |
| 4. Schema & Chat Management | v1.1 | 3/3 | Complete | 2026-03-24 |
| 5. Model Selection & Switching | v1.1 | 2/2 | Complete | 2026-03-24 |
| 6. Tags System | v1.1 | 3/3 | Complete | 2026-03-24 |
| 7. Fuzzy Search & Attachment Polish | v1.1 | 2/2 | Complete | 2026-03-24 |
| 8. Foundation | v2.0 | 3/3 | Complete | 2026-03-26 |
| 9. Read-Only Skills | v2.0 | 2/2 | Complete | 2026-03-26 |
| 10. Core Persistence | v2.0 | 2/2 | Complete | 2026-03-27 |
| 11. Continuation + Context | v2.0 | 3/3 | Complete | 2026-03-27 |
| 12. Management + Tags | v2.0 | 3/3 | Complete | 2026-03-27 |
| 13. Persistence Reliability | v2.1 | 2/2 | Shipped | 2026-03-30 |
| 14. Context Awareness | v2.1 | 1/1 | Shipped | 2026-03-30 |
| 15. Chat Rollover | v2.1 | 2/2 | Shipped | 2026-03-31 |
| 16. Compact Integration | v2.1 | 2/2 | Shipped | 2026-03-31 |
| 17. Hook Subcommands | v2.2 | 2/2 | Complete    | 2026-04-04 |
| 18. SKILL.md Migration | v2.2 | 2/2 | Complete    | 2026-04-06 |
| 19. Setup & Distribution | v2.2 | - | Merged into Phase 21 | - |
| 20. Documentation & Publish | v2.2 | 0/TBD | Not started | - |
| 21. Global Skill Installation | v2.2 | 3/3 | Complete    | 2026-04-06 |
