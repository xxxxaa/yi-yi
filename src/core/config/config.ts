import JSON5 from "json5";
import fs from "node:fs/promises";
import path from "node:path";
import type { YiYiConfig } from "./types.ts";
import { configSchema } from "./schema.ts";

const DEFAULT_CONFIG_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".yiyi");
const CONFIG_FILENAME = "config.json5";
const MAX_BACKUPS = 5;

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    return process.env[name] ?? "";
  });
}

export function resolveConfigEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") {
    return resolveEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveConfigEnvVars);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveConfigEnvVars(v)]));
  }
  return obj;
}

export function getConfigPath(configDir?: string): string {
  return path.join(configDir ?? DEFAULT_CONFIG_DIR, CONFIG_FILENAME);
}

export async function loadConfig(configPath?: string): Promise<YiYiConfig> {
  const filePath = configPath ?? getConfigPath();

  let raw: unknown = {};
  try {
    const content = await fs.readFile(filePath, "utf-8");
    raw = JSON5.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  const resolved = resolveConfigEnvVars(raw);
  return configSchema.parse(resolved);
}

export async function backupConfig(configPath: string): Promise<void> {
  const backupDir = path.join(path.dirname(configPath), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `config-${timestamp}.json5`);
  await fs.copyFile(configPath, backupPath);

  const entries = await fs.readdir(backupDir);
  const backups = entries
    .filter((f) => f.startsWith("config-"))
    .toSorted()
    .toReversed();

  const stale = backups.slice(MAX_BACKUPS).map((old) => fs.unlink(path.join(backupDir, old)));
  await Promise.all(stale);
}

export async function saveConfig(config: YiYiConfig, configPath?: string): Promise<void> {
  const filePath = configPath ?? getConfigPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(filePath);
    await backupConfig(filePath);
  } catch {
    // File doesn't exist yet, no backup needed
  }

  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(filePath, content, "utf-8");
}
