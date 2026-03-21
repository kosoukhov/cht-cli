---
name: chat
description: Start a new chat conversation with Claude. Creates a new chat and enters an interactive REPL where you can have a live conversation with streaming responses.
allowed-tools: Bash(node --experimental-strip-types src/commands/new-chat.ts *)
argument-hint: [project-name]
---

Start a new interactive chat with Claude.

Run the following command. If the user specified a project name, pass it as the first argument. Otherwise omit it to use the default "general" project:

```bash
node --experimental-strip-types src/commands/new-chat.ts $ARGUMENTS
```

The script creates a new chat file and enters an interactive REPL loop. It handles the entire conversation -- streaming responses, file attachments, and message persistence. Wait for it to complete (the user will type /exit or press Ctrl+C to end).
