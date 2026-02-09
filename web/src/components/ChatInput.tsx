import { useState, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <textarea
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
            placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={1}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
}
