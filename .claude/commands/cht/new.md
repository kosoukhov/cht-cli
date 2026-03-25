---
description: "Create a new chat conversation and activate session tracking."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "[project] [title]"
---

Create a new chat conversation.

**Arguments:**
- `project` (optional, default: "general") -- the project to create the chat in
- `title` (optional, default: "(untitled)") -- the chat title

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts create $ARGUMENTS`
   - If no arguments provided, use: `node --experimental-strip-types bin/cht.ts create general "(untitled)"`
2. Parse the JSON output.
3. On success (`ok: true`):
   - Run: `node --experimental-strip-types bin/cht.ts session-set <chat_path> <project>` to activate session tracking
   - Tell the user: "Created new chat: **{title}** in project **{project}**"
   - Show the file path
4. On failure (`ok: false`):
   - Tell the user: "Something went wrong: {error message}. Check that chats/ directory exists and is writable."
