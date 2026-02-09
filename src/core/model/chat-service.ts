import type { YiYiConfig } from "../config/types.ts";
import type { StreamEvent } from "./types.ts";
import { getLogger } from "../logging/logger.ts";
import { resolveModelRef, resolvePrimaryModel } from "./model-resolver.ts";
import { resolveAdapter } from "./provider-registry.ts";
import { SessionStore } from "./session-store.ts";

const logger = getLogger("chat-service");

export interface ChatParams {
  sessionId: string;
  content: string;
}

export class ChatService {
  private config: YiYiConfig;
  private sessionStore = new SessionStore();

  constructor(opts: { config: YiYiConfig }) {
    this.config = opts.config;
  }

  async *chat(params: ChatParams): AsyncIterable<StreamEvent> {
    const { sessionId, content } = params;

    // 添加用户消息到会话
    this.sessionStore.addMessage(sessionId, { role: "user", content });

    const messages = this.sessionStore.getMessages(sessionId);
    const { primary, fallbacks } = resolvePrimaryModel(this.config);
    const modelRefs = [primary, ...fallbacks];

    let lastError: unknown;

    for (const ref of modelRefs) {
      try {
        const resolved = resolveModelRef(ref, this.config);
        const adapter = resolveAdapter(resolved);

        logger.info({ model: ref }, "Calling model");

        let assistantContent = "";

        // eslint-disable-next-line no-await-in-loop -- intentional: try models sequentially with fallback
        for await (const event of adapter.streamChat({
          model: resolved.modelId,
          messages,
        })) {
          if (event.type === "delta") {
            assistantContent += event.content;
          }
          yield event;
        }

        // 成功完成，保存助手回复到会话
        if (assistantContent) {
          this.sessionStore.addMessage(sessionId, {
            role: "assistant",
            content: assistantContent,
          });
        }
        return;
      } catch (err) {
        lastError = err;
        logger.warn({ model: ref, err: String(err) }, "Model call failed, trying fallback");
      }
    }

    // 所有模型都失败
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    yield { type: "error", error: { code: "MODEL_ERROR", message } };
  }

  deleteSession(sessionId: string): void {
    this.sessionStore.deleteSession(sessionId);
  }
}
