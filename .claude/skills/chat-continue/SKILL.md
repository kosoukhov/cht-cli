---
name: chat-continue
description: Continue an existing chat conversation with Claude. Shows a list of recent chats to select from, then resumes the conversation with full history preserved.
allowed-tools: Bash(node --experimental-strip-types src/commands/continue-chat.ts *)
argument-hint: [project-name]
---

Continue an existing chat conversation with Claude.

Run the following command. If the user specified a project name, pass it as the first argument. Otherwise omit it to use the default "general" project:

```bash
node --experimental-strip-types src/commands/continue-chat.ts $ARGUMENTS
```

The script lists recent chats in the project, prompts the user to select one by number, then enters the REPL with the full conversation history loaded. Wait for it to complete.
