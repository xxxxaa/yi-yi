import fs from "node:fs";
import path from "node:path";
import { Logger } from "tslog";
import { redactObject } from "./redact.ts";

type LogLevel = "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_MAP: Record<LogLevel, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

const DEFAULT_LOG_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? ".",
  ".yiyi",
  "logs",
);
const LOG_PREFIX = "yiyi";
const LOG_SUFFIX = ".log";
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LoggerSettings {
  level?: LogLevel;
  logDir?: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLogFilePath(logDir: string, date?: Date): string {
  const d = formatLocalDate(date ?? new Date());
  return path.join(logDir, `${LOG_PREFIX}-${d}${LOG_SUFFIX}`);
}

function pruneOldLogs(logDir: string): void {
  try {
    const entries = fs.readdirSync(logDir, { withFileTypes: true });
    const cutoff = Date.now() - MAX_LOG_AGE_MS;
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !entry.name.startsWith(`${LOG_PREFIX}-`) ||
        !entry.name.endsWith(LOG_SUFFIX)
      ) {
        continue;
      }
      const fullPath = path.join(logDir, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(fullPath, { force: true });
        }
      } catch {
        // ignore errors during pruning
      }
    }
  } catch {
    // ignore missing dir or read errors
  }
}

function resolveLogLevel(settings?: LoggerSettings): number {
  const envLevel = process.env.YIYI_LOG_LEVEL as LogLevel | undefined;
  const level = envLevel ?? settings?.level ?? "info";
  return LEVEL_MAP[level] ?? LEVEL_MAP.info;
}

function createFileTransport(logDir: string): (logObj: Record<string, unknown>) => void {
  fs.mkdirSync(logDir, { recursive: true });
  pruneOldLogs(logDir);

  return (logObj: Record<string, unknown>) => {
    try {
      const filePath = getLogFilePath(logDir);
      const time = new Date().toISOString();
      const redacted = redactObject(logObj) as Record<string, unknown>;
      const line = JSON.stringify({ ...redacted, time });
      fs.appendFileSync(filePath, `${line}\n`, { encoding: "utf8" });
    } catch {
      // never block on logging failures
    }
  };
}

let rootLogger: Logger<unknown> | undefined;

export function initLogger(settings?: LoggerSettings): Logger<unknown> {
  const logDir = settings?.logDir ?? DEFAULT_LOG_DIR;
  const minLevel = resolveLogLevel(settings);

  rootLogger = new Logger({
    name: "yiyi",
    minLevel,
    type: "pretty",
  });

  rootLogger.attachTransport(createFileTransport(logDir));
  return rootLogger;
}

export function getLogger(name?: string): Logger<unknown> {
  if (!rootLogger) {
    rootLogger = initLogger();
  }
  if (name) {
    return rootLogger.getSubLogger({ name });
  }
  return rootLogger;
}

export function getChildLogger(bindings?: Record<string, unknown>): Logger<unknown> {
  return getLogger().getSubLogger(bindings);
}
