---
name: cht-rename
description: "Rename a chat conversation title."
allowed-tools: Bash(cht *)
argument-hint: "[project]"
---

Rename a chat conversation's title. Only updates the title in frontmatter -- the file path does not change.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse chats from

**Steps:**

1. Run: `cht list $ARGUMENTS --recent 10`
2. Parse the JSON output.
3. If `chats` array is empty, say: "No chats found. Start a new chat with /cht-new."
4. Show the chat list formatted as:
   ```
   Recent chats:

   {number}. {title} [#tag1 #tag2]  ({relative_date})
     {preview}
   ```
   For relative dates use the `lastModified` field:
   - "today" if same day
   - "yesterday" if one day ago
   - "N days ago" for 2-30 days
   - "YYYY-MM-DD" for over 30 days
   Only show `[#tag1 #tag2]` if chat has non-empty tags array. Each tag prefixed with `#`, separated by single space inside brackets.
   Only show the preview line if preview is non-empty.
5. Ask: "Which chat do you want to rename? (enter number)"
6. Ask: "What should the new title be?"
7. Run: `cht rename <selected_chat_path> <new_title>`
8. On success (`ok: true`): Say "Renamed to **{new_title}**."
9. On failure (`ok: false`): Say "Could not rename chat: {error}."
