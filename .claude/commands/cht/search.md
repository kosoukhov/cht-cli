---
description: "Search chats by title, tags, or content."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "<query> [project] [--all]"
---

Search chats by title, tags, or content.

**Arguments:**
- `query` (required) -- the search term
- `project` (optional, default: "general") -- the project to search in
- `--all` (optional) -- search across all projects

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts search $ARGUMENTS`
   - If only a query is provided: `node --experimental-strip-types bin/cht.ts search general <query>`
   - If project and query: `node --experimental-strip-types bin/cht.ts search <project> <query>`
   - Add `--all` flag if the user wants to search all projects
2. Parse the JSON output.
3. On success (`ok: true`):
   - If `results` array is empty, tell the user: "No results for \"{query}\". Try a different search term or check /cht:list to browse."
   - Otherwise, format each result showing:
     - Title and match type (title match, content match, or both)
     - Project name
     - Content match snippets if available
4. On failure (`ok: false`):
   - Tell the user: "Something went wrong: {error message}. Check that chats/ directory exists and is writable."
