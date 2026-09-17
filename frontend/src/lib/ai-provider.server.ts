import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Provider-agnostic AI layer (server-only — never import from client code).
 *
 * Configure with env vars:
 *   AI_PROVIDER   openai (default) | anthropic | google
 *   AI_MODEL      optional model id override
 *   OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
 */
export type AiProviderName = "openai" | "anthropic" | "google";

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-1.5-flash",
};

const API_KEY_ENV: Record<AiProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export function getAiProviderName(): AiProviderName {
  const raw = (process.env["AI_PROVIDER"] ?? "openai").toLowerCase();
  if (raw === "anthropic" || raw === "google" || raw === "openai") return raw;
  return "openai";
}

/** True when the configured provider has an API key available. */
export function isAiConfigured(provider: AiProviderName = getAiProviderName()): boolean {
  return Boolean(process.env[API_KEY_ENV[provider]]);
}

/**
 * Returns a language model for the configured provider, or `null` when no
 * API key is present so callers can fall back gracefully.
 */
export function getAiModel(options?: {
  provider?: AiProviderName;
  model?: string;
}): LanguageModel | null {
  const provider = options?.provider ?? getAiProviderName();
  const apiKey = process.env[API_KEY_ENV[provider]];
  if (!apiKey) return null;

  const modelId = options?.model ?? process.env["AI_MODEL"] ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "openai":
    default:
      return createOpenAI({ apiKey })(modelId);
  }
}