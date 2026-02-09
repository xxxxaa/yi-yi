import type { ProviderAdapter, ResolvedModel } from "./types.ts";
import { createAnthropicAdapter } from "./anthropic-adapter.ts";
import { createOpenAiAdapter } from "./openai-adapter.ts";

type AdapterFactory = (resolved: ResolvedModel) => ProviderAdapter;

const registry = new Map<string, AdapterFactory>([
  ["openai-completions", createOpenAiAdapter],
  ["anthropic-messages", createAnthropicAdapter],
]);

export function resolveAdapter(resolved: ResolvedModel): ProviderAdapter {
  const factory = registry.get(resolved.apiType);
  if (!factory) {
    throw new Error(`Unsupported API type "${resolved.apiType}"`);
  }
  return factory(resolved);
}
