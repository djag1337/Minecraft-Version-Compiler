import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as { __mcAnthropic?: Anthropic };

export const anthropic = globalForAnthropic.__mcAnthropic ?? new Anthropic();
if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.__mcAnthropic = anthropic;
}

export const CHAT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
