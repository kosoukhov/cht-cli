---
name: cht-include
description: "Load a previous chat as read-only context. Use when the user wants to reference, review, or recall what was discussed in an earlier conversation."
allowed-tools:
  - Read
  - Bash(cht *)
argument-hint: "[project]"
---

Load a previous chat conversation as background context. This does NOT change your active chat session -- it only brings old conversation content into the current context for reference.

**Arguments:**
- `project` (optional, default: "general") -- the project to browse chats from

**Steps:**

1. Run: `cht list $ARGUMENTS --recent 10` to get the 10 most recent chats.
2. Parse the JSON output.
3. If no chats found (`chats` array is empty), tell the user: "No chats found in this project. Create chats first with /cht-new [project]."
4. Show the chat list formatted as:
   ```
   Available chats to include:

   {number}. {title}  ({relative_date})
   ```
   For relative dates use the `lastModified` field:
   - "today" if same day
   - "yesterday" if one day ago
   - "N days ago" for 2-30 days
   - "YYYY-MM-DD" for over 30 days
5. Ask the user which chat they want to include as context (by number).
6. Once the user selects a chat:
   - Use the Read tool to read the file at the full path from the list output (the `path` field). If the file content is very large (estimate 500+ lines), summarize instead of presenting verbatim.
7. Load and present the chat content:
   - **If 500 lines or fewer:** Present the content with a header:
     "**Background context from chat: {title} ({date})**"
     followed by the full chat content.
   - **If more than 500 lines:** Summarize the content, covering: the main topics discussed, key decisions made, important outcomes or conclusions, and where the conversation left off. Present the summary with a header:
     "**Background context from chat: {title} ({date}) -- summarized ({line_count} lines)**"
8. If the selected chat has no messages (only frontmatter with no `## User` or `## Assistant` sections), say: "This chat has no messages to include as context."
9. Tell the user: "Context loaded. You can reference this information in your conversation. Run /cht-include again to load additional chats."

**IMPORTANT:** Do NOT run `session-set`. This command only loads context -- it does not change which chat is being recorded to. Your current active session (if any) remains unchanged.
