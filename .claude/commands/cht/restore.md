---
description: "Restore an archived chat conversation."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "[project]"
---

Restore a previously archived chat conversation back to active chats.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse archived chats from

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts list $ARGUMENTS --archived` (uses --archived flag to list only archived chats)
2. Parse the JSON output.
3. If `chats` array is empty, say: "No archived chats found."
4. Show the archived list formatted as:
   ```
   {N} archived chat(s):

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
5. Ask: "Which chat do you want to restore? (enter number)"
6. Run: `node --experimental-strip-types bin/cht.ts restore <selected_chat_path> <project>` (project from args, default "general")
7. On success (`ok: true`): Say "Restored **{title}**. It is now back in your active chats."
8. On failure (`ok: false`): Say "Could not restore chat: {error}."
