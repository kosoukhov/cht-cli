---
description: "Resume a previous chat conversation with full history loaded."
allowed-tools: Read, Bash(node --experimental-strip-types bin/cht.ts *), Bash(wc *)
argument-hint: "[project]"
---

Resume a previous chat conversation. Loads the full conversation history into context and activates message persistence so new messages are appended to the existing chat file.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse chats from

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts list $ARGUMENTS --recent 10` to get the 10 most recent chats.
2. Parse the JSON output.
3. If no chats found (`chats` array is empty), tell the user: "No chats found in this project. Start a new chat with /cht:new [project]."
4. Show the chat list formatted as:
   ```
   Recent chats:

   {number}. {title}  ({relative_date})
   ```
   For relative dates use the `lastModified` field:
   - "today" if same day
   - "yesterday" if one day ago
   - "N days ago" for 2-30 days
   - "YYYY-MM-DD" for over 30 days
5. Ask the user which chat they want to continue (by number).
6. Once the user selects a chat:
   - Use the Read tool to read the file at the full path from the list output (the `path` field). Read the entire file -- do not truncate.
   - Run: `node --experimental-strip-types bin/cht.ts session-set <selected_chat_path> <project>` to activate session tracking. This ensures hooks start saving new messages to this chat file.
   - Provide a brief 2-3 sentence summary of the conversation covering: what it was about, what was decided or accomplished, and where it left off.
   - Tell the user: "Chat resumed. New messages will be appended to this conversation. Use /cht:end to stop recording."
7. If the selected chat has no messages (only frontmatter), say: "This chat has no messages yet. You can start the conversation now."
