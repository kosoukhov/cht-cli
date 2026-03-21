// Message heading delimiters -- these are the ONLY recognized message boundaries
export const USER_HEADING = "## User";
export const ASSISTANT_HEADING = "## Assistant";

// Regex to match message headings (only outside code blocks -- caller must track state)
export const HEADING_PATTERN = /^## (User|Assistant)\s*$/;

// Regex to match opening fence (3+ backticks or 3+ tildes)
export const FENCE_OPEN_PATTERN = /^(`{3,}|~{3,})/;

// Default model for new chats
export const DEFAULT_MODEL =
  process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || "claude-sonnet-4-20250514";

// Project config filename
export const PROJECT_CONFIG_FILENAME = "_config.yaml";
