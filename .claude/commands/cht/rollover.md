---
description: "Roll over the current chat -- end it and start a new one with linked context."
allowed-tools: Read, Bash(node --experimental-strip-types bin/cht.ts *), Bash(wc *)
argument-hint: ""
---

Roll over the current chat: close it and start a fresh chat file with a link back to the old one. Automatically loads context from the previous conversation so you can continue seamlessly.

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts rollover`
2. Parse the JSON output.
3. On success (`ok: true`):
   - Tell the user: "Rolled over to new chat: **{title}** in project **{project}**"
   - Show both file paths:
     - Old chat: `{old_chat_path}`
     - New chat: `{new_chat_path}`
   - Now load context from the old chat:
     - Run: `wc -l < {old_chat_path}` to count the lines.
     - Parse the number from the output.
     - **If 500 lines or fewer:** Use the Read tool to read the full old chat file. Present it with a header:
       "**Context from previous chat: {title}**"
       followed by the full content.
     - **If more than 500 lines:** Use the Read tool to read the full old chat file. Then summarize the content, covering: the main topics discussed, key decisions made, important outcomes or conclusions, and where the conversation left off. Present the summary with a header:
       "**Context from previous chat: {title} -- summarized ({line_count} lines)**"
   - Tell the user: "Context loaded. You can continue the conversation -- all new messages will be saved to the new chat file."
4. On failure (`ok: false`): Say the error message from the `error` field.
