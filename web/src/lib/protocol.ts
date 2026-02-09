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

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let counter = 0;
export function generateId(): string {
  return `msg_${Date.now()}_${++counter}`;
}
