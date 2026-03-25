---
description: "List chat conversations with optional filtering by recency, tags, or archive status."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "[project] [--recent N] [--tag TAG] [--archived]"
---

List chat conversations with optional filtering.

**Arguments:**
- `project` (optional, default: "general") -- the project to list chats from
- `--recent N` (optional) -- show only the N most recent chats
- `--tag TAG` (optional) -- filter chats by tag
- `--archived` (optional) -- list archived chats instead of active ones

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts list $ARGUMENTS`
2. Parse the JSON output.
3. On success (`ok: true`):
   - If `chats` array is empty, tell the user: "No chats found. Start a new chat with /cht:new [project]."
   - Otherwise, format each chat as:
     ```
     {number}. {title}  ({relative_date})
       [{tag1}, {tag2}]
       {preview}
     ```
   - For relative dates use: "today" if same day, "yesterday" if one day ago, "N days ago" for 2-30 days, or "YYYY-MM-DD" for over 30 days.
   - Only show the tags line if the chat has tags.
   - Only show the preview line if there is a preview.
4. On failure (`ok: false`):
   - Tell the user: "Something went wrong: {error message}. Check that chats/ directory exists and is writable."
