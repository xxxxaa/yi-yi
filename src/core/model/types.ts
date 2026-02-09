export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; usage?: TokenUsage }
  | { type: "error"; error: { code: string; message: string } };

export interface StreamChatParams {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface ProviderAdapter {
  streamChat(params: StreamChatParams): AsyncIterable<StreamEvent>;
}

export interface ResolvedModel {
  providerName: string;
  modelId: string;
  apiType: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}
