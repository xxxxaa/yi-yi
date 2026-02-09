import type { z } from "zod";
import type { configSchema } from "./schema.ts";

export type YiYiConfig = z.infer<typeof configSchema>;
