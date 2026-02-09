import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, ResolvedModel, StreamChatParams, StreamEvent } from "./types.ts";

const DEFAULT_MAX_TOKENS = 4096;

export function createAnthropicAdapter(resolved: ResolvedModel): ProviderAdapter {
  const client = new Anthropic({
    apiKey: resolved.apiKey,
    baseURL: resolved.baseUrl,
    defaultHeaders: resolved.headers,
  });

  return {
    async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
      // Anthropic 要求 system 消息单独传递
      let systemPrompt: string | undefined;
      const messages: Anthropic.MessageParam[] = [];

      for (const msg of params.messages) {
        if (msg.role === "system") {
          systemPrompt = msg.content;
        } else {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      const stream = client.messages.stream({
        model: params.model,
        max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "delta", content: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: "done",
        usage: {
          promptTokens: finalMessage.usage.input_tokens,
          completionTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
    },
  };
}
