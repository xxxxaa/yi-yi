import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  backupConfig,
  loadConfig,
  resolveConfigEnvVars,
  resolveEnvVars,
  saveConfig,
} from "./config.ts";

describe("resolveEnvVars", () => {
  it("replaces ${VAR} with env value", () => {
    process.env.TEST_KEY_ABC = "secret123";
    expect(resolveEnvVars("key=${TEST_KEY_ABC}")).toBe("key=secret123");
    delete process.env.TEST_KEY_ABC;
  });

  it("replaces missing vars with empty string", () => {
    delete process.env.NONEXISTENT_VAR_XYZ;
    expect(resolveEnvVars("${NONEXISTENT_VAR_XYZ}")).toBe("");
  });

  it("handles multiple replacements", () => {
    process.env.A_VAR = "hello";
    process.env.B_VAR = "world";
    expect(resolveEnvVars("${A_VAR} ${B_VAR}")).toBe("hello world");
    delete process.env.A_VAR;
    delete process.env.B_VAR;
  });

  it("returns string unchanged without placeholders", () => {
    expect(resolveEnvVars("no vars here")).toBe("no vars here");
  });
});

describe("resolveConfigEnvVars", () => {
  it("resolves nested objects", () => {
    process.env.NESTED_VAR = "resolved";
    const result = resolveConfigEnvVars({
      a: { b: "${NESTED_VAR}" },
    });
    expect(result).toEqual({ a: { b: "resolved" } });
    delete process.env.NESTED_VAR;
  });

  it("resolves arrays", () => {
    process.env.ARR_VAR = "item";
    const result = resolveConfigEnvVars(["${ARR_VAR}", "plain"]);
    expect(result).toEqual(["item", "plain"]);
    delete process.env.ARR_VAR;
  });

  it("passes through non-string primitives", () => {
    expect(resolveConfigEnvVars(42)).toBe(42);
    expect(resolveConfigEnvVars(true)).toBe(true);
    expect(resolveConfigEnvVars(null)).toBe(null);
  });
});

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yiyi-config-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when config file missing", async () => {
    const config = await loadConfig(path.join(tmpDir, "missing.json5"));
    expect(config.logging.level).toBe("info");
    expect(config.gateway.port).toBe(3000);
    expect(config.gateway.host).toBe("localhost");
  });

  it("loads JSON5 config with comments", async () => {
    const configPath = path.join(tmpDir, "config.json5");
    await fs.writeFile(
      configPath,
      `{
        // This is a comment
        gateway: { port: 8080, },
      }`,
    );
    const config = await loadConfig(configPath);
    expect(config.gateway.port).toBe(8080);
  });

  it("resolves env vars in config values", async () => {
    process.env.YIYI_TEST_API_KEY = "sk-test-123";
    const configPath = path.join(tmpDir, "config.json5");
    await fs.writeFile(
      configPath,
      `{
        providers: {
          anthropic: { apiKey: "\${YIYI_TEST_API_KEY}" },
        },
      }`,
    );
    const config = await loadConfig(configPath);
    expect(config.providers?.anthropic?.apiKey).toBe("sk-test-123");
    delete process.env.YIYI_TEST_API_KEY;
  });

  it("throws on invalid config", async () => {
    const configPath = path.join(tmpDir, "config.json5");
    await fs.writeFile(configPath, `{ gateway: { port: "not-a-number" } }`);
    await expect(loadConfig(configPath)).rejects.toThrow();
  });
});

describe("backupConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yiyi-backup-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates backup in backups/ directory", async () => {
    const configPath = path.join(tmpDir, "config.json5");
    await fs.writeFile(configPath, "{}");
    await backupConfig(configPath);

    const backupDir = path.join(tmpDir, "backups");
    const files = await fs.readdir(backupDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^config-.*\.json5$/);
  });

  it("keeps only 5 most recent backups", async () => {
    const configPath = path.join(tmpDir, "config.json5");
    const backupDir = path.join(tmpDir, "backups");
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(configPath, "{}");

    const writes = Array.from({ length: 7 }, (_, i) => {
      const ts = `2026-01-0${i + 1}T00-00-00-000Z`;
      return fs.writeFile(path.join(backupDir, `config-${ts}.json5`), "{}");
    });
    await Promise.all(writes);

    await backupConfig(configPath);

    const files = await fs.readdir(backupDir);
    expect(files.filter((f) => f.startsWith("config-"))).toHaveLength(5);
  });
});

describe("saveConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yiyi-save-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves config and creates backup of existing", async () => {
    const configPath = path.join(tmpDir, "config.json5");
    await fs.writeFile(configPath, '{ "gateway": { "port": 3000 } }');

    await saveConfig(
      { logging: { level: "debug" }, gateway: { port: 8080, host: "0.0.0.0" } },
      configPath,
    );

    const content = await fs.readFile(configPath, "utf-8");
    expect(JSON.parse(content).gateway.port).toBe(8080);

    const backupDir = path.join(tmpDir, "backups");
    const backups = await fs.readdir(backupDir);
    expect(backups).toHaveLength(1);
  });

  it("creates parent directory if missing", async () => {
    const configPath = path.join(tmpDir, "sub", "dir", "config.json5");
    await saveConfig(
      { logging: { level: "info" }, gateway: { port: 3000, host: "localhost" } },
      configPath,
    );

    const content = await fs.readFile(configPath, "utf-8");
    expect(JSON.parse(content).logging.level).toBe("info");
  });
});
