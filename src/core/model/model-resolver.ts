import type { YiYiConfig } from "../config/types.ts";
import type { ResolvedModel } from "./types.ts";

export function resolveModelRef(ref: string, config: YiYiConfig): ResolvedModel {
  const slashIndex = ref.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Invalid model reference "${ref}": expected "provider/model" format`);
  }

  const providerName = ref.slice(0, slashIndex);
  const modelId = ref.slice(slashIndex + 1);

  const provider = config.providers?.[providerName];
  if (!provider) {
    throw new Error(`Provider "${providerName}" not found in config`);
  }

  return {
    providerName,
    modelId,
    apiType: provider.api ?? "openai-completions",
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    headers: provider.headers,
  };
}

export function resolvePrimaryModel(config: YiYiConfig): { primary: string; fallbacks: string[] } {
  if (!config.model?.primary) {
    throw new Error("No primary model configured in config.model.primary");
  }
  return {
    primary: config.model.primary,
    fallbacks: config.model.fallbacks ?? [],
  };
}
