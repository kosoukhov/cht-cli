---
description: "Delete a chat conversation permanently."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "[project]"
---

Delete a chat conversation permanently. This cannot be undone.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse chats from

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts list $ARGUMENTS --recent 10`
2. Parse the JSON output.
3. If `chats` array is empty, say: "No chats found. Start a new chat with /cht:new."
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
5. Ask: "Which chat do you want to delete? (enter number)"
6. Once selected, first check if this chat is the active session: run `node --experimental-strip-types bin/cht.ts session-get` and compare the path.
7. Show confirmation: "Delete **{title}**? This cannot be undone."
8. Wait for user to confirm (yes/y). If they decline: "Delete cancelled."
9. On confirm, run: `node --experimental-strip-types bin/cht.ts delete <selected_chat_path>`
10. On success (`ok: true`): Say "Deleted **{title}**." If the deleted chat was the active session (from step 6), add: "Chat session ended automatically."
11. On failure (`ok: false`): Say "Could not delete chat: {error}."
