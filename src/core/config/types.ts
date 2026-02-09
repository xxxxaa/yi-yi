import type { z } from "zod";
import type { configSchema } from "./schema.ts";

export type AppConfig = z.infer<typeof configSchema>;
