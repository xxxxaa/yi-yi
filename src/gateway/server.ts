import http from "node:http";
import { WebSocketServer } from "ws";
import { getLogger } from "../core/logging/logger.ts";

const logger = getLogger("gateway");

interface ServerOptions {
  port?: number;
  host?: string;
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
