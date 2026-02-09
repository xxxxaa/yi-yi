import OpenAI from "openai";
import type { ProviderAdapter, ResolvedModel, StreamChatParams, StreamEvent } from "./types.ts";

export function createOpenAiAdapter(resolved: ResolvedModel): ProviderAdapter {
  const client = new OpenAI({
    apiKey: resolved.apiKey,
    baseURL: resolved.baseUrl,
    defaultHeaders: resolved.headers,
  });

  return {
    async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
      const stream = await client.chat.completions.create({
        model: params.model,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: params.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "delta", content: delta };
        }

        if (chunk.usage) {
          yield {
            type: "done",
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
          return;
        }

        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason === "stop" || finishReason === "length") {
          // usage 可能在后续 chunk 中，不在此处 yield done
        }
      }

      // 如果流结束但没有 usage chunk，仍然发送 done
      yield { type: "done" };
    },
  };
}
