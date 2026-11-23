import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { SYSTEM_POLICY } from "./roscoAutoMailCore";

const DEFAULT_MODEL = "gpt-6.2-sol";
// Includes reasoning and visible text; accepted reply bytes are checked separately.
const MAX_OUTPUT_TOKENS = 2_048;
interface MailClient {
  responses: { create(request: ResponseCreateParamsNonStreaming): Promise<unknown> };
}
type ClientFactory = (options: { apiKey: string; maxRetries: number; timeout: number; logLevel: "off" }) => MailClient;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Fail closed instead of treating output_text, reasoning, or refusals as reply text. */
function replyText(response: unknown): string {
  if (!record(response) || response.status !== "completed" || response.error != null ||
      response.incomplete_details != null || !Array.isArray(response.output)) return "";
  const parts: string[] = [];
  for (const item of response.output) {
    if (!record(item)) return "";
    if (item.type === "reasoning") continue;
    if (item.type !== "message" || item.role !== "assistant" || item.status !== "completed" ||
        !Array.isArray(item.content) || item.content.length === 0) return "";
    for (const content of item.content) {
      if (!record(content) || content.type !== "output_text" || typeof content.text !== "string") return "";
      parts.push(content.text);
    }
  }
  const text = parts.join("\n");
  if (Buffer.byteLength(text) > 4_000 || !text.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) return "";
  return text.trim();
}

/** No client or credential access at module load; transport is injectable for offline tests. */
export function createMailGenerator(
  config: { apiKey: string; model?: string },
  createClient: ClientFactory = options => new OpenAI(options),
): (transcript: string) => Promise<string> {
  let client: MailClient | undefined;
  return async transcript => {
    if (!transcript.trim() || Buffer.byteLength(transcript) > 32_000) return "";
    if (!config.apiKey.trim()) throw new Error("Mail generation unavailable");
    try {
      client ??= createClient({ apiKey: config.apiKey, maxRetries: 0, timeout: 25_000, logLevel: "off" });
      const response = await client.responses.create({
        model: config.model?.trim() || DEFAULT_MODEL,
        instructions: SYSTEM_POLICY,
        input: [{ role: "user", content: [{ type: "input_text", text: transcript }] }],
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: { format: { type: "text" } },
      });
      return replyText(response);
    } catch {
      // Never propagate SDK errors: they may contain request/response content or credentials.
      throw new Error("Mail generation unavailable");
    }
  };
}
