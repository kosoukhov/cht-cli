---
description: "Add or remove tags on a chat."
allowed-tools: Bash(node --experimental-strip-types bin/cht.ts *)
argument-hint: "<add|remove> <tag>"
---

Add or remove tags on a chat. Operates on the active chat by default.

**Arguments:**
- `add <tag>` -- add a tag to the chat
- `remove <tag>` -- remove a tag from the chat

**Steps:**

1. Parse the user's command to extract the operation (add/remove) and tag name. If operation is missing, say: "Usage: /cht:tag add <tag> or /cht:tag remove <tag>". If tag name is missing, ask: "Which tag?"
2. Determine the target chat: Run `node --experimental-strip-types bin/cht.ts session-get`. If `active` is not null, use `active.chat_path` as the target; also run `node --experimental-strip-types bin/cht.ts read <chat_path>` to get the chat title for display. If `active` is null, fall back to chat selection: run `node --experimental-strip-types bin/cht.ts list general --recent 10`, say "No active chat. Recent chats:", show numbered list formatted as:
   ```
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
   Ask the user to pick a number.
3. Execute: For add: `node --experimental-strip-types bin/cht.ts tag-add <path> <tag>`. For remove: `node --experimental-strip-types bin/cht.ts tag-remove <path> <tag>`.
4. On success (`ok: true`):
   - For add: Compare returned `tags` array length. Say "Tag **#**{tag} added to **{title}**. Current tags: {#tag1 #tag2 ...}" If the tag was already present (tags array length unchanged or tag was already in the list before), say "Tag **#**{tag} is already on **{title}**. Current tags: {#tag1 #tag2 ...}"
   - For remove: Compare returned `tags` array. Say "Tag **#**{tag} removed from **{title}**. Current tags: {#tag1 #tag2 ...}" or "No tags remaining." if the tags array is empty. If the tag was not present (tags array unchanged), say "Tag **#**{tag} is not on **{title}**. Current tags: {#tag1 #tag2 ...}" or "No tags on this chat." if the tags array is empty.
5. On failure (`ok: false`): Say "Could not update tags: {error}."
