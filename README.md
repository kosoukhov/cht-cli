# /cht -- Chat Persistence for Claude Code

A set of slash commands for saving and managing conversation history in Claude Code.
Chats are stored as markdown files in `chats/`, grouped by project.

## Installation

Requirements: Node.js 22+, Claude Code CLI.

```bash
npm install -g cht-cli
```

Or use without installing:

```bash
npx cht-cli
```

Open Claude Code in your project directory:

```bash
claude
```

All `/cht:*` commands and auto-save hooks are picked up automatically from `.claude/`.

## Quick Start

```
/cht:new myproject "Auth refactor"                # create a chat
...                                               # work as usual
/cht:end                                          # stop recording
```

On next Claude Code launch:

```
/cht:continue myproject                           # resume the chat
```

## Commands

### Chat Lifecycle

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht:new` | `[project] [title]` | Create a new chat and enable auto-save |
| `/cht:end` | -- | Stop recording messages |
| `/cht:continue` | `[project]` | Resume a previous chat (loads history + enables recording) |
| `/cht:include` | `[project]` | Load a chat as context (without recording) |

### Browsing and Search

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht:list` | `[project] [--recent N] [--tag TAG] [--archived]` | List chats with filtering |
| `/cht:search` | `<query> [project] [--all]` | Search by title and content |

### Management

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/cht:rename` | `[project]` | Rename a chat |
| `/cht:tag` | `<add\|remove> <tag>` | Add/remove a tag |
| `/cht:archive` | `[project]` | Move to archive |
| `/cht:restore` | `[project]` | Restore from archive |
| `/cht:delete` | `[project]` | Delete permanently |
| `/cht:status` | -- | Show current chat stats (size, messages, chain info) |
| `/cht:rollover` | -- | Start a new file for the current chat, linking old and new |

## Usage Examples

### Start recording a conversation

```
/cht:new                              # general / (untitled)
/cht:new work                         # project=work, untitled
/cht:new work "Payment bug"           # project=work, with title
```

After creation, all messages are automatically saved to the file.
Recording stops on `/cht:end` or when you exit Claude Code.

### Resume yesterday's conversation

```
/cht:continue work
```

Shows the 10 most recent chats in the project; you pick one.
Claude loads the full history, gives a brief summary, and enables recording.

### Load context from another chat

```
/cht:include work
```

Loads the chat contents for reference, but does **not** switch the active session.
Useful when you need to recall a previous discussion without interrupting current recording.

### Find where a topic was discussed

```
/cht:search "authorization"             # in the general project
/cht:search "authorization" work        # in the work project
/cht:search "authorization" --all       # across all projects
```

### Organize chats with tags

```
/cht:tag add bugfix
/cht:tag add review
/cht:tag remove bugfix
```

Works with the active chat. If there is no active chat, you will be prompted to select one.

Filter by tags:

```
/cht:list --tag bugfix
/cht:list work --tag review
```

### Housekeeping

```
/cht:archive work       # move an old chat to the archive
/cht:restore work       # bring it back
/cht:list --archived    # view archived chats
/cht:rename work        # rename a chat
/cht:delete work        # delete permanently (irreversible)
```

## Projects

A project is simply a way to group chats. The default project is `general`.
You do not need to create projects in advance -- they appear when you create the first chat.

```
/cht:new general "Notes"
/cht:new work "Sprint 14"
/cht:new personal "Ideas"
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

## License

[MIT](LICENSE)
