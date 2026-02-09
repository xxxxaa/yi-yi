import type { ChatMessage } from "./types.ts";

const MAX_HISTORY_LENGTH = 50;

export class SessionStore {
  private sessions = new Map<string, ChatMessage[]>();

  getMessages(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) ?? [];
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    let messages = this.sessions.get(sessionId);
    if (!messages) {
      messages = [];
      this.sessions.set(sessionId, messages);
    }
    messages.push(message);
    this.trimHistory(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private trimHistory(sessionId: string): void {
    const messages = this.sessions.get(sessionId);
    if (!messages || messages.length <= MAX_HISTORY_LENGTH) {
      return;
    }

    // 保留 system 消息 + 最近的消息
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    const kept = nonSystem.slice(-MAX_HISTORY_LENGTH + systemMessages.length);
    this.sessions.set(sessionId, [...systemMessages, ...kept]);
  }
}
