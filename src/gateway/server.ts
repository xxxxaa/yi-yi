import type { WebSocket } from "ws";
import http from "node:http";
import { WebSocketServer } from "ws";
import { formatErrorMessage, formatUncaughtError, toErrorPayload } from "../core/infra/errors.ts";
import { getLogger } from "../core/logging/logger.ts";

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

export async function startServer(opts: ServerOptions = {}): Promise<http.Server> {
  const port = opts.port ?? 3000;
  const host = opts.host ?? "localhost";

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "yiyi-gateway" }));
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");
    ws.on("message", (data) => {
      ws.send(data);
    });
    ws.on("error", (err) => {
      logger.error({ err: formatErrorMessage(err) }, "WebSocket error");
    });
    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
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
