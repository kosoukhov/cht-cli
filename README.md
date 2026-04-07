# /cht — Chat Persistence for Claude Code

[![npm version](https://img.shields.io/npm/v/@kosoukhov/cht-cli.svg)](https://www.npmjs.com/package/@kosoukhov/cht-cli)
[![license](https://img.shields.io/npm/l/@kosoukhov/cht-cli.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@kosoukhov/cht-cli.svg)](package.json)

> Save, search, and continue Claude Code conversations as local markdown files.

13 slash commands for managing conversation history in Claude Code. Every message is crash-proof saved to a markdown file, organized by project, readable offline in any editor.

## Installation

Requirements: Node.js 22+, Claude Code CLI.

```bash
npm install -g @kosoukhov/cht-cli
cht setup
```

`cht setup` registers 13 slash commands and 4 auto-save hooks in your Claude Code configuration. Run it once after installation, and again after updates.

Verify the installation:

```bash
cht doctor
```

## Quick Start

```
/cht-new myproject "Auth refactor"                # create a chat
...                                               # work as usual — messages auto-saved
/cht-end                                          # stop recording
```

On next Claude Code launch:

```
/cht-continue myproject                           # resume the chat
```

## Commands

### Chat Lifecycle

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht-new` | `[project] [title]` | Create a new chat and enable auto-save |
| `/cht-end` | -- | Stop recording messages |
| `/cht-continue` | `[project]` | Resume a previous chat (loads history + enables recording) |
| `/cht-include` | `[project]` | Load a chat as context (without recording) |

### Browsing and Search

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht-list` | `[project] [--recent N] [--tag TAG] [--archived]` | List chats with filtering |
| `/cht-search` | `<query> [project] [--all]` | Search by title and content |

### Management

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht-rename` | `[project]` | Rename a chat |
| `/cht-tag` | `<add\|remove> <tag>` | Add/remove a tag |
| `/cht-archive` | `[project]` | Move to archive |
| `/cht-restore` | `[project]` | Restore from archive |
| `/cht-delete` | `[project]` | Delete permanently |
| `/cht-status` | -- | Show current chat stats (size, messages, chain info) |
| `/cht-rollover` | -- | Start a new file for the current chat, linking old and new |

## Setup Commands

These are terminal commands (not Claude Code slash commands):

| Command | Description |
|---------|-------------|
| `cht setup` | Copy skills to `~/.claude/skills/` and register hooks in `~/.claude/settings.json` |
| `cht doctor` | Validate installation: skills present, hooks registered, CLI on PATH, storage accessible |
| `cht migrate` | Remove old `.claude/commands/cht/` format if present |

## Usage Examples

### Start recording a conversation

```
/cht-new                              # general / (untitled)
/cht-new work                         # project=work, untitled
/cht-new work "Payment bug"           # project=work, with title
```

After creation, all messages are automatically saved to the file.
Recording stops on `/cht-end` or when you exit Claude Code.

### Resume yesterday's conversation

```
/cht-continue work
```

Shows the 10 most recent chats in the project; you pick one.
Claude loads the full history, gives a brief summary, and enables recording.

### Load context from another chat

```
/cht-include work
```

Loads the chat contents for reference, but does **not** switch the active session.
Useful when you need to recall a previous discussion without interrupting current recording.

### Find where a topic was discussed

```
/cht-search "authorization"             # in the general project
/cht-search "authorization" work        # in the work project
/cht-search "authorization" --all       # across all projects
```

### Organize chats with tags

```
/cht-tag add bugfix
/cht-tag add review
/cht-tag remove bugfix
```

Works with the active chat. If there is no active chat, you will be prompted to select one.

Filter by tags:

```
/cht-list --tag bugfix
/cht-list work --tag review
```

### Housekeeping

```
/cht-archive work       # move an old chat to the archive
/cht-restore work       # bring it back
/cht-list --archived    # view archived chats
/cht-rename work        # rename a chat
/cht-delete work        # delete permanently (irreversible)
```

## Projects

A project is simply a way to group chats. The default project is `general`.
You do not need to create projects in advance -- they appear when you create the first chat.

```
/cht-new general "Notes"
/cht-new work "Sprint 14"
/cht-new personal "Ideas"
```

## Storage

Chats are saved in `chats/` as markdown files with YAML frontmatter:

```
chats/
  general/
    2026-03-30-notes.md
  work/
    2026-03-30-sprint-14.md
```

Each file is plain markdown that can be read, edited, and committed to git.

### Storage Location

The storage directory is resolved in this priority order:

1. `CHAT_STORAGE_DIR` environment variable (explicit override)
2. `CLAUDE_PROJECT_DIR/chats` (set automatically by Claude Code hooks)
3. `./chats` in the current working directory (default)

To use a custom storage location:

```bash
export CHAT_STORAGE_DIR="$HOME/my-chats"
```

Run `cht doctor` to see which storage path is currently active.

## Upgrading from v1.x

If you used the old `/cht:command` syntax (colon-separated):

```bash
npm install -g @kosoukhov/cht-cli    # install latest
cht setup                             # register new skills and hooks
cht migrate                           # remove old .claude/commands/cht/ format
cht doctor                            # verify everything is green
```

Key changes:
- Command syntax: `/cht:new` is now `/cht-new` (colon replaced with hyphen)
- Skills location: moved from `.claude/commands/cht/` to `~/.claude/skills/cht-*/`
- Installation: one-time `cht setup` required after `npm install`

## License

[MIT](LICENSE)
