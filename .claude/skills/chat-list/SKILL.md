---
name: chat-list
description: List, filter, delete, archive, and restore chat conversations. Supports --recent N, --archived, --delete, --archive, --archived --restore.
allowed-tools: Bash(node --experimental-strip-types src/commands/list-chats.ts *)
argument-hint: [project-name] [--recent N] [--archived] [--delete] [--archive] [--archived --restore]
---

List chat conversations with optional filtering and management.

Run the following command. If the user specified a project name, pass it as the first argument. Add flags as needed:

```bash
node --experimental-strip-types src/commands/list-chats.ts $ARGUMENTS
```

**Flags:**
- `--recent N` -- show only the N most recent chats (default 10 if N omitted)
- `--archived` -- list archived chats instead of active ones
- `--delete` -- interactive picker to permanently delete a chat
- `--archive` -- interactive picker to archive a chat
- `--archived --restore` -- interactive picker to restore an archived chat

**Examples:**
- `node --experimental-strip-types src/commands/list-chats.ts myproject` -- list all active chats
- `node --experimental-strip-types src/commands/list-chats.ts myproject --recent 5` -- list 5 most recent
- `node --experimental-strip-types src/commands/list-chats.ts myproject --archived` -- list archived chats
- `node --experimental-strip-types src/commands/list-chats.ts myproject --delete` -- interactively delete a chat
- `node --experimental-strip-types src/commands/list-chats.ts myproject --archive` -- interactively archive a chat
- `node --experimental-strip-types src/commands/list-chats.ts myproject --archived --restore` -- interactively restore

The script displays chats with titles and relative dates. Interactive modes (--delete, --archive, --restore) prompt for selection and confirmation.
