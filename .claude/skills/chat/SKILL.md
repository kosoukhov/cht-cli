---
name: chat
description: Start a new chat conversation with Claude. Creates a new chat and enters an interactive REPL where you can have a live conversation with streaming responses. Use --include to pre-load an old chat as context.
allowed-tools: Bash(node --experimental-strip-types src/commands/new-chat.ts *)
argument-hint: [project-name] [--include]
---

Start a new interactive chat with Claude.

Run the following command. If the user specified a project name, pass it as the first argument. Otherwise omit it to use the default "general" project. Add `--include` to pre-load an old chat as context:

```bash
node --experimental-strip-types src/commands/new-chat.ts $ARGUMENTS
```

The script creates a new chat file and enters an interactive REPL loop. It handles the entire conversation -- streaming responses, file attachments, and message persistence. Wait for it to complete (the user will type /exit or press Ctrl+C to end).

REPL commands available during chat:
- `/include` -- include an old chat as background context
- `/search <query> [--all]` -- search across chats and optionally include results
- `/tokens` -- show context window usage details
- `/exit` -- end the chat session
