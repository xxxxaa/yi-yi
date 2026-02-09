import { Chat } from "./components/Chat";

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-gray-800">YiYi</h1>
        <span className="ml-2 text-sm text-gray-400">AI 智能助手</span>
      </header>
      <Chat />
    </div>
  );
}
