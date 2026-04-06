---
name: cht-list
description: "List chat conversations with filtering by recency, tags, or archive status. Use when the user wants to see their chats, browse conversations, or check what chats exist."
allowed-tools: Bash(cht *)
argument-hint: "[project] [--recent N] [--tag TAG] [--archived]"
---

List chat conversations with optional filtering.

**Arguments:**
- `project` (optional) -- the project to list chats from
- `--recent N` (optional) -- show only the N most recent chats
- `--tag TAG` (optional) -- filter chats by tag
- `--archived` (optional) -- list archived chats instead of active ones

**Steps:**

1. **Resolve project.** If no project argument was provided in `$ARGUMENTS`:
   a. Run: `cht projects`
   b. Parse the JSON output. The `projects` array lists available project names.
   c. If `projects` is empty: say "No chats found. Start a new chat with /cht-new [project]." and stop.
   d. If exactly one project: use that project name automatically.
   e. If multiple projects: use AskUserQuestion to let the user pick a project. Options are the project names from the array.
2. Run: `cht list {resolved_project} {remaining_flags_from_ARGUMENTS}`
3. Parse the JSON output.
4. On success (`ok: true`):
   - If `chats` array is empty, say: "No chats found in project {project}. Start a new chat with /cht-new {project}."
   - Otherwise, show total count at top: "N chat(s) in {project}:" or "N archived chat(s) in {project}:" if `--archived` was used.
   - Format each chat as:
     ```
     {number}. {title} [#tag1 #tag2]  ({relative_date})
       {preview}
     ```
   - For relative dates use the `lastModified` field:
     - "today" if same day
     - "yesterday" if one day ago
     - "N days ago" for 2-30 days
     - "YYYY-MM-DD" for over 30 days
   - Only show the `[#tag1 #tag2]` part if the chat has tags (non-empty tags array). Each tag prefixed with `#`, separated by single space inside brackets.
   - Only show the preview line if preview is non-empty.
5. On failure (`ok: false`): Say "Could not list chats: {error}."
