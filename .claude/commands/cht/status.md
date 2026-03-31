---
description: "Show size and status of the active chat conversation."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: ""
---

Show statistics and size warning for the active chat.

**Steps:**

1. Run: `node --experimental-strip-types bin/cht.ts status`
2. Parse the JSON output.
3. On success (`ok: true`):
   - Show the chat info as key-value lines:
     ```
     Chat: {title}
     Project: {project}
     Messages: {message_count}
     File size: {file_size_bytes formatted as KB or MB}
     Est. tokens: ~{estimated_tokens formatted with comma separators}
     ```
   - If `compact_count` > 0, insert after Messages line: `Compactions: {compact_count}`
   - For file size formatting:
     - Under 1024 bytes: "{n} B"
     - Under 1048576 bytes: "{n/1024, 1 decimal} KB"
     - 1048576+ bytes: "{n/1048576, 1 decimal} MB"
   - For token estimate: prefix with `~` and use comma separators
   - If `warning` is non-null, show it on a separate line after a blank line, prefixed with **Warning:**
   - If `chain` is non-null, show chain links after a blank line:
     - If `chain.continued_from` exists: show "Continued from: **{title}** (`{path}`)"
     - If `chain.continued_in` exists: show "Continued in: **{title}** (`{path}`)"
4. On failure (`ok: false`): Say the error message from the `error` field.
