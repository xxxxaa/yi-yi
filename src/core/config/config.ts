import type { AppConfig } from "./types.ts";
import { configSchema } from "./schema.ts";

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  return configSchema.parse(overrides ?? {});
}
