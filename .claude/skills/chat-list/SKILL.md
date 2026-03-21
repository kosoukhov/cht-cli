---
name: chat-list
description: List all chat conversations. Shows chats organized by project with titles and dates.
allowed-tools: Bash(node --experimental-strip-types src/commands/list-chats.ts *)
argument-hint: [project-name]
---

List all chat conversations.

Run the following command. If the user specified a project name, pass it as the first argument to list only that project's chats. Otherwise omit it to list chats across all projects:

```bash
node --experimental-strip-types src/commands/list-chats.ts $ARGUMENTS
```

The script displays chats with titles and relative dates. It returns immediately after printing (no interactive loop).
