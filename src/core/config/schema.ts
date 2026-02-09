import { z } from "zod";

const modelConfigSchema = z.object({
  primary: z.string(),
  fallbacks: z.array(z.string()).optional(),
});

const providerConfigSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  auth: z.enum(["api-key", "aws-sdk", "oauth", "token"]).optional(),
  api: z
    .enum([
      "openai-completions",
      "openai-responses",
      "anthropic-messages",
      "google-generative-ai",
      "github-copilot",
      "bedrock-converse-stream",
    ])
    .optional(),
  headers: z.record(z.string()).optional(),
});

const loggingConfigSchema = z.object({
  level: z.enum(["silly", "trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  file: z.string().optional(),
});

const gatewayConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default("localhost"),
});

export const configSchema = z.object({
  model: modelConfigSchema.optional(),
  imageModel: modelConfigSchema.optional(),
  providers: z.record(providerConfigSchema).optional(),
  logging: loggingConfigSchema.default({}),
  gateway: gatewayConfigSchema.default({}),
});
