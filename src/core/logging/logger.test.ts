import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLogFilePath, initLogger } from "./logger.ts";

describe("getLogFilePath", () => {
  it("generates dated log file path", () => {
    const result = getLogFilePath("/tmp/logs", new Date("2026-03-15"));
    expect(result).toBe("/tmp/logs/yiyi-2026-03-15.log");
  });

  it("uses current date by default", () => {
    const result = getLogFilePath("/tmp/logs");
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(`/tmp/logs/yiyi-${today}.log`);
  });
});

describe("initLogger", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yiyi-log-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates logger and writes to file", () => {
    const logger = initLogger({ level: "info", logDir: tmpDir });
    logger.info("test message");

    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, `yiyi-${today}.log`);
    const content = fs.readFileSync(logFile, "utf-8");
    expect(content).toContain("test message");
  });

  it("redacts sensitive data in log files", () => {
    const logger = initLogger({ level: "info", logDir: tmpDir });
    logger.info({ apiKey: "sk-abcdefghijklmnopqrstuvwxyz" }, "with secret");

    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, `yiyi-${today}.log`);
    const content = fs.readFileSync(logFile, "utf-8");
    expect(content).toContain("[REDACTED]");
    expect(content).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
  });
});
