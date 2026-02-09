import type { WebSocket } from "ws";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import type { ServerMessage } from "./protocol/types.ts";
import { loadConfig } from "../core/config/config.ts";
import { formatErrorMessage, formatUncaughtError, toErrorPayload } from "../core/infra/errors.ts";
import { getLogger } from "../core/logging/logger.ts";
import { ChatService } from "../core/model/chat-service.ts";
import { isClientMessage } from "./protocol/types.ts";

const logger = getLogger("gateway");

process.on("uncaughtException", (err) => {
  const message = formatUncaughtError(err);
  logger.fatal({ err: message }, "Uncaught exception in Gateway");
});

process.on("unhandledRejection", (reason) => {
  const message = formatUncaughtError(reason);
  logger.error({ err: message }, "Unhandled rejection in Gateway");
});

interface ServerOptions {
  port?: number;
  host?: string;
}

export function sendWsError(ws: WebSocket, id: string, err: unknown): void {
  ws.send(JSON.stringify({ id, error: toErrorPayload(err) }));
}

export function sendHttpError(res: http.ServerResponse, status: number, err: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: toErrorPayload(err) }));
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(
  webRoot: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  const url = req.url ?? "/";
  // API 路由不走静态文件
  if (url.startsWith("/api") || url.startsWith("/ws")) {
    return false;
  }

  let filePath = path.join(webRoot, url === "/" ? "index.html" : url);
  // SPA fallback: 如果文件不存在且没有扩展名，返回 index.html
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(webRoot, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
}

function handleWsMessage(
  ws: WebSocket,
  raw: Buffer | string,
  chatService: ChatService,
  sessionId: string,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
  } catch {
    sendWsError(ws, "unknown", new Error("Invalid JSON"));
    return;
  }

  if (!isClientMessage(parsed)) {
    sendWsError(ws, "unknown", new Error("Invalid message format"));
    return;
  }

  const { id, content } = parsed;
  logger.info({ id }, "Chat message received");

  // 异步流式调用 AI 模型
  void (async () => {
    try {
      for await (const event of chatService.chat({ sessionId, content })) {
        if (event.type === "delta") {
          const delta: ServerMessage = { id, type: "chat.delta", content: event.content };
          ws.send(JSON.stringify(delta));
        } else if (event.type === "done") {
          const done: ServerMessage = { id, type: "chat.done" };
          ws.send(JSON.stringify(done));
        } else if (event.type === "error") {
          const errMsg: ServerMessage = { id, type: "error", error: event.error };
          ws.send(JSON.stringify(errMsg));
        }
      }
    } catch (err) {
      sendWsError(ws, id, err);
    }
  })();
}

export async function startServer(opts: ServerOptions = {}): Promise<http.Server> {
  const config = await loadConfig();
  const port = opts.port ?? config.gateway.port;
  const host = opts.host ?? config.gateway.host;

  const chatService = new ChatService({ config });

  // 静态文件目录（生产模式）
  const webRoot = path.resolve(import.meta.dirname ?? ".", "../../web/dist");

  const server = http.createServer((req, res) => {
    // 健康检查
    if (req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "yiyi-gateway" }));
      return;
    }

    // 静态文件服务
    if (serveStatic(webRoot, req, res)) {
      return;
    }

    // 默认 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }));
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const sessionId = crypto.randomUUID();
    logger.info({ sessionId }, "WebSocket client connected");
    ws.on("message", (data) => {
      try {
        handleWsMessage(ws, data as Buffer | string, chatService, sessionId);
      } catch (err) {
        sendWsError(ws, "unknown", err);
      }
    });
    ws.on("error", (err) => {
      logger.error({ err: formatErrorMessage(err) }, "WebSocket error");
    });
    ws.on("close", () => {
      chatService.deleteSession(sessionId);
      logger.info({ sessionId }, "WebSocket client disconnected");
    });
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      logger.info(`Gateway listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}

// Direct execution
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("gateway/server.ts");

if (isDirectRun) {
  startServer();
}
