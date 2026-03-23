---
name: chat-search
description: Search across chat conversations for specific text. Shows matching chats with context lines. Use --all to search all projects.
allowed-tools: Bash(node --experimental-strip-types src/commands/search-chats.ts *)
argument-hint: <query> [--all] [project-name]
---

Search for text across chat conversations.

Run the following command with the user's search query:

```bash
node --experimental-strip-types src/commands/search-chats.ts $ARGUMENTS
```

Arguments:
- First argument: the search query (required)
- `--all`: search across all projects (optional, default is current project)
- Last argument: project name (optional, defaults to "general")

Examples:
- `/chat-search recursion` -- search for "recursion" in the default project
- `/chat-search "API design" --all` -- search all projects for "API design"
- `/chat-search database my-project` -- search "database" in my-project

The script displays matching chats with context lines showing where matches were found. Results are sorted by most recent first, capped at 20 results.
