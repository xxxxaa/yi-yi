/** 客户端 → 服务端 */
export interface ClientMessage {
  id: string;
  type: "chat";
  content: string;
}

/** 服务端 → 客户端 */
export interface ServerMessage {
  id: string;
  type: "chat.delta" | "chat.done" | "error";
  content?: string;
  error?: { code: string; message: string };
}

export function isClientMessage(data: unknown): data is ClientMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return typeof msg.id === "string" && msg.type === "chat" && typeof msg.content === "string";
}
