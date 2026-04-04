import { z } from "zod/v4";

const BaseHookInput = z.object({
  session_id: z.string(),
  hook_event_name: z.string(),
});

export const UserPromptInput = BaseHookInput.extend({
  hook_event_name: z.literal("UserPromptSubmit"),
  prompt: z.string(),
}).passthrough();

export const StopInput = BaseHookInput.extend({
  hook_event_name: z.literal("Stop"),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().nullable().optional(),
}).passthrough();

export const PostCompactInput = BaseHookInput.extend({
  hook_event_name: z.literal("PostCompact"),
  trigger: z.enum(["auto", "manual"]),
}).passthrough();

export const SessionEndInput = BaseHookInput.extend({
  hook_event_name: z.literal("SessionEnd"),
}).passthrough();

/**
 * Read all of stdin, parse as JSON, validate against a Zod schema.
 * Returns the typed, validated result.
 * Throws on invalid JSON or schema mismatch.
 */
export async function readStdinJson<T>(schema: z.ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}
