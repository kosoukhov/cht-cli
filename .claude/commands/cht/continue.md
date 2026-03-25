---
description: "Resume a previous chat conversation."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "[project]"
---

Resume a previous chat conversation.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse chats from

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts list $ARGUMENTS --recent 10` to get the 10 most recent chats.
2. Parse the JSON output.
3. If no chats found, tell the user: "No chats found. Start a new chat with /cht:new [project]."
4. Show the chat list formatted as:
   ```
   {number}. {title}  ({relative_date})
   ```
5. Ask the user which chat they want to continue (by number).
6. Once the user selects a chat:
   - Run: `node --experimental-strip-types bin/cht.ts read <selected_chat_path>` to load the conversation.
   - Run: `node --experimental-strip-types bin/cht.ts session-set <selected_chat_path> <project>` to activate session tracking.
   - Display the conversation history (messages from the chat).
   - Tell the user the chat is now active and they can continue the conversation.
