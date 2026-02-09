import { z } from "zod";

export const configSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default("localhost"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
