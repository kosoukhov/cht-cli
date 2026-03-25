---
description: "Search chats by title, tags, or content."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "<query> [project] [--all]"
---

Search chats by title, tags, or content.

**Arguments:**
- `query` (required) -- the search term (can be multiple words)
- `project` (optional, default: "general") -- the project to search in
- `--all` (optional) -- search across all projects

**Steps:**

1. Run the search command. IMPORTANT: pass all query words as separate arguments -- the CLI joins them internally.
   - Query only: `node --experimental-strip-types bin/cht.ts search general word1 word2 ...`
   - With project: `node --experimental-strip-types bin/cht.ts search <project> word1 word2 ...`
   - Add `--all` flag at the end if searching all projects.
2. Parse the JSON output.
3. On success (`ok: true`):
   - If `results` array is empty, say: "No results for the query. Try a different search term or check /cht:list to browse."
   - Otherwise, show total count at top: "Found N result(s) for \"{query}\":"
   - Format each result showing:
     - Number, chatTitle, and matchType label in parentheses
     - For matchType: show "title match" for `"title"`, "content match" for `"content"`, "title + content" for `"both"`
     - Only show the tags line if the tags array is non-empty
     - For content or both matches: show up to 3 match snippets indented with `>`
     - For title-only matches: skip the snippet lines
   - Example output:
     ```
     Found 3 result(s) for "react hooks":

     1. React Hooks Tutorial (title match)
     2. Dev Notes (content match)
        Tags: react, dev
        > Line 42: I want to learn about custom hooks pattern in React.
     3. Advanced Patterns (title + content)
        > Line 15: React hooks are powerful for state management.
     ```
4. On failure (`ok: false`): Say "Search failed: {error}."
