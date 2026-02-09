import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEntry, ClientMessage, ServerMessage } from "../lib/protocol";
import { generateId } from "../lib/protocol";
import { useWebSocket } from "../hooks/useWebSocket";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

const WS_URL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;

export function Chat() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { status, send, subscribe } = useWebSocket(WS_URL);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (content: string) => {
      const id = generateId();

      // 添加用户消息
      const userMsg: ChatEntry = { id, role: "user", content };
      setMessages((prev) => [...prev, userMsg]);

      // 添加空的助手消息占位
      const assistantId = `${id}_reply`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      // 订阅服务端响应
      const unsubscribe = subscribe(id, (msg: ServerMessage) => {
        if (msg.type === "chat.delta" && msg.content) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + msg.content }
                : m,
            ),
          );
        } else if (msg.type === "chat.done") {
          unsubscribe();
        } else if (msg.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `错误: ${msg.error?.message ?? "未知错误"}` }
                : m,
            ),
          );
          unsubscribe();
        }
      });

      // 发送消息到服务端
      const clientMsg: ClientMessage = { id, type: "chat", content };
      send(clientMsg);
    },
    [send, subscribe],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center pt-32 text-gray-400">
              <p>发送消息开始对话</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      {status === "disconnected" && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">
          连接已断开，正在重连...
        </div>
      )}
      {status === "connecting" && (
        <div className="bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-600">
          正在连接...
        </div>
      )}
      <ChatInput onSend={handleSend} disabled={status !== "connected"} />
    </div>
  );
}
