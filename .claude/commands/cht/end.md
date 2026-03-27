---
description: "End the current chat session and stop message persistence."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
---

End the current chat session. This clears the active session state so hooks stop saving messages.

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts session-get`
2. Parse the JSON output.
3. If `active` is null:
   - Tell the user: "No active chat session to end."
4. If `active` is not null:
   - Note the chat_path from the response.
   - Run: `node --experimental-strip-types bin/cht.ts session-clear`
   - Tell the user: "Chat session ended. Messages will no longer be saved."
   - Show the chat file path so the user knows where their conversation is stored.
