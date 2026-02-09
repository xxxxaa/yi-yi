# YiYi 技术设计文档

## 〇、技术栈总览

### 0.1 核心技术栈

| 层级 | 技术选型 | 版本要求 | 说明 |
|------|----------|----------|------|
| 运行时 | Node.js | 22+ | 原生 `node:sqlite`、ESM strict |
| 语言 | TypeScript | 5.5+ | ESM strict 模式，`"type": "module"` |
| 包管理 | pnpm | 9+ | workspace 单仓管理 |
| 构建 | tsdown | latest | 基于 Rolldown 的 TypeScript 构建工具 |
| 测试 | Vitest | latest | 兼容 Jest API，原生 ESM 支持 |
| 代码规范 | oxlint + oxfmt | latest | Rust 实现，极速 lint/format |
| 数据库 | node:sqlite + SQLite | 内置 | Node 22 原生绑定，零外部依赖 |
| 向量搜索 | sqlite-vec | latest | SQLite 扩展，本地向量检索 |
| 全文搜索 | FTS5 | 内置 | SQLite 内置全文搜索引擎 |
| 配置 | JSON5 + Zod | - | 支持注释的配置 + 运行时类型校验 |
| 日志 | tslog | 4+ | 结构化 JSON 行日志 |
| CLI 框架 | Commander.js | latest | 命令行交互 |
| Gateway | ws + node:http | - | WebSocket + HTTP 多路复用服务 |

### 0.2 与 openclaw 技术对齐

YiYi 参考 openclaw 项目的架构模式，在以下方面保持对齐：

- **CLI + Gateway 架构**：采用 CLI 命令行工具 + 本地 Gateway 服务的分层架构
- **模型适配层**：复用 `ModelApi`、`ModelDefinitionConfig`、`ModelProviderConfig` 类型体系
- **故障转移**：采用 `runWithModelFallback` 模式，支持 auth-profile 冷却
- **错误处理**：极简 3 函数设计（`extractErrorCode` / `formatErrorMessage` / `formatUncaughtError`）
- **配置管理**：JSON5 格式 + Zod schema 校验 + 环境变量替换
- **日志系统**：tslog 库 + JSON 行格式 + 按日滚动

### 0.3 Node 22+ 关键特性利用

| 特性 | 用途 |
|------|------|
| `node:sqlite` | 原生 SQLite 绑定，替代 better-sqlite3 等第三方库 |
| 原生 ESM | 全项目 ESM strict，无 CommonJS 兼容负担 |
| `--experimental-strip-types` | 开发阶段可直接运行 .ts 文件 |

---

## 〇二、项目结构

### 0.4 目录组织

```
src/
  cli/                  # CLI 命令行工具
    commands/           # 子命令 (generate, query, material, ...)
    program.ts          # Commander 命令注册
    entry.ts            # CLI 入口
  gateway/              # Gateway 服务
    server.ts           # WebSocket + HTTP 服务器
    protocol/           # 通信协议定义
    methods/            # RPC 方法实现
    client.ts           # Gateway 客户端（CLI 用）
  core/                 # 核心业务逻辑（CLI/Gateway 共享）
    config/             # 配置管理 (JSON5 + Zod)
      config.ts         # 配置加载入口
      schema.ts         # Zod schema 定义
      types.ts          # 配置类型导出
    db/                 # 数据库层 (node:sqlite)
      connection.ts     # 连接管理
      migrations.ts     # schema 迁移
      queries/          # 按领域拆分的查询模块
    logging/            # 日志系统 (tslog)
      logger.ts         # 日志初始化与导出
    models/             # 多模型适配
      types.models.ts   # 模型类型定义
      model-fallback.ts # 故障转移
      model-selection.ts# 模型选择与别名
    services/           # 业务服务层
      material/         # 物料解析
      content/          # 内容生成
      customer/         # 客户管理
      query/            # 楼盘查询
      match/            # 智能匹配
      tour/             # 带看助手
      message/          # 消息中心
    infra/              # 基础设施
      errors.ts         # 错误处理工具函数
      cache.ts          # 本地缓存层
      rate-limit.ts     # 进程内限流
```

### 0.5 编码规范

| 规范 | 要求 |
|------|------|
| 测试文件 | 与源文件共存，命名 `*.test.ts` |
| 类型定义 | 细粒度拆分，按领域组织（如 `types.models.ts`、`types.config.ts`） |
| 单文件行数 | ≤ 700 行，超出则拆分 |
| 导出方式 | 具名导出优先，避免 `export default` |
| 错误处理 | 业务层用 FailoverError，基础层用工具函数 |

---

## 〇三、配置管理系统

参考 openclaw `src/config/` 架构设计。

### 0.6 配置格式

采用 JSON5 格式，支持注释和尾逗号：

```json5
// ~/.yiyi/config.json5
{
  // 模型配置
  model: {
    primary: "anthropic/claude-sonnet-4-20250514",
    fallbacks: [
      "openai/gpt-4o",
      "qwen/qwen-max",
    ],
  },

  // 提供商配置
  providers: {
    anthropic: {
      apiKey: "${ANTHROPIC_API_KEY}",  // 环境变量替换
    },
    openai: {
      apiKey: "${OPENAI_API_KEY}",
    },
  },

  // 日志配置
  logging: {
    level: "info",
    file: "~/.yiyi/logs/yiyi.log",
  },
}
```

### 0.7 Zod Schema 校验

```typescript
import { z } from "zod";

const ModelConfigSchema = z.object({
  primary: z.string(),
  fallbacks: z.array(z.string()).optional(),
});

const ProviderConfigSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  auth: z.enum(["api-key", "aws-sdk", "oauth", "token"]).optional(),
  api: z.enum([
    "openai-completions", "openai-responses",
    "anthropic-messages", "google-generative-ai",
    "github-copilot", "bedrock-converse-stream",
  ]).optional(),
  headers: z.record(z.string()).optional(),
  models: z.array(z.any()).optional(),
});

const YiYiConfigSchema = z.object({
  model: ModelConfigSchema.optional(),
  imageModel: ModelConfigSchema.optional(),
  providers: z.record(ProviderConfigSchema).optional(),
  logging: z.object({
    level: z.enum(["silly", "trace", "debug", "info", "warn", "error", "fatal"]).optional(),
    file: z.string().optional(),
  }).optional(),
});

export type YiYiConfig = z.infer<typeof YiYiConfigSchema>;
```

### 0.8 环境变量替换

配置值中的 `${VAR}` 占位符在加载时自动替换为对应环境变量：

```typescript
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name) => {
    return process.env[name] ?? "";
  });
}

function resolveConfigEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveConfigEnvVars);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, resolveConfigEnvVars(v)])
    );
  }
  return obj;
}
```

### 0.9 配置备份轮转

每次写入配置前自动备份，保留最近 5 个版本：

```typescript
async function backupConfig(configPath: string): Promise<void> {
  const backupDir = path.join(path.dirname(configPath), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `config-${timestamp}.json5`);
  await fs.copyFile(configPath, backupPath);

  // 保留最近 5 个备份
  const backups = (await fs.readdir(backupDir))
    .filter(f => f.startsWith("config-"))
    .sort()
    .reverse();

  for (const old of backups.slice(5)) {
    await fs.unlink(path.join(backupDir, old));
  }
}
```

### 0.10 类型安全加载流程

```
读取 JSON5 文件 → 解析为对象 → 环境变量替换 → Zod schema 校验 → 返回类型安全配置
```

```typescript
import JSON5 from "json5";

async function loadConfig(configPath: string): Promise<YiYiConfig> {
  const raw = await fs.readFile(configPath, "utf-8");
  const parsed = JSON5.parse(raw);
  const resolved = resolveConfigEnvVars(parsed);
  return YiYiConfigSchema.parse(resolved);
}
```

---

## 〇四、日志系统

参考 openclaw `src/logging/logger.ts` 设计。

### 0.11 日志库选型

采用 tslog 库，输出 JSON 行格式文件日志：

```typescript
import { Logger } from "tslog";
import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_LOG_DIR = "~/.yiyi/logs";

interface LoggerSettings {
  level?: "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  file?: string;
}

let logger: Logger<unknown>;

export function getLogger(): Logger<unknown> {
  if (!logger) {
    logger = createLogger({ level: "info" });
  }
  return logger;
}

export function getChildLogger(
  bindings?: Record<string, unknown>,
): Logger<unknown> {
  return getLogger().getSubLogger(bindings);
}
```

### 0.12 按日滚动

日志文件按日期命名，格式 `yiyi-YYYY-MM-DD.log`：

```typescript
function getLogFilePath(baseDir: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(baseDir, `yiyi-${date}.log`);
}

function createFileTransport(logDir: string) {
  let currentDate = "";
  let stream: fs.WriteStream | null = null;

  return (logObj: Record<string, unknown>) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentDate) {
      stream?.end();
      currentDate = today;
      const filePath = getLogFilePath(logDir);
      stream = fs.createWriteStream(filePath, { flags: "a" });
    }
    stream?.write(JSON.stringify(logObj) + "\n");
  };
}
```

### 0.13 敏感信息过滤

自动过滤日志中的 API Key、Token 等敏感信息：

```typescript
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI API Key
  /anthropic-[a-zA-Z0-9]{20,}/g,    // Anthropic API Key
  /Bearer\s+[a-zA-Z0-9._-]+/g,      // Bearer Token
  /token["\s:=]+["']?[a-zA-Z0-9._-]{20,}/gi, // 通用 Token
];

function redactSensitive(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
```

### 0.14 日志级别配置

通过配置文件或环境变量控制日志级别：

```typescript
// 优先级：环境变量 > 配置文件 > 默认值
function resolveLogLevel(config?: LoggerSettings): number {
  const envLevel = process.env.YIYI_LOG_LEVEL;
  const level = envLevel ?? config?.level ?? "info";
  const levelMap = { silly: 0, trace: 1, debug: 2, info: 3, warn: 4, error: 5, fatal: 6 };
  return levelMap[level as keyof typeof levelMap] ?? 3;
}
```

---

## 详细设计文档

本文档为技术设计总览，详细设计按架构层级拆分为以下子文档：

| 模块 | 文档 | 包含章节 | 说明 |
|------|------|----------|------|
| 多模型适配 | [model-adaptation.md](tech-design/model-adaptation.md) | 六 | 模型抽象、降级链、故障转移、提供商适配 |
| 业务服务 | [business-services.md](tech-design/business-services.md) | 一~二、七~十五 | 物料解析、内容生成、AI讲房、PPT、客户管理、查询、匹配、计算器、消息、带看、IP形象 |
| 基础设施 | [infra.md](tech-design/infra.md) | 十六~十八 | 认证授权、错误处理、限流与缓存 |
| 数据库 | [database-schema.md](tech-design/database-schema.md) | 十九 | 完整表结构、迁移机制、FTS 索引 |

---

## 三、数据流设计

### 3.1 物料上传数据流

```typescript
// 上传请求
interface UploadRequest {
  projectId: string;
  files: File[];
}

// 解析任务
interface ParseTask {
  id: string;
  fileId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ParseResult;
  error?: string;
}

// 解析结果
interface ParseResult {
  fileType: string;
  category: string;
  extractedData: Record<string, any>;
  confidence: number;
}
```

### 3.2 内容生成数据流

```typescript
// 生成请求
interface GenerateRequest {
  projectId: string;
  contentType: 'xiaohongshu' | 'video_script' | 'moments';
  template?: string;
  style: ContentStyle;
  highlights?: string[];
}

// 生成响应（流式）
interface GenerateResponse {
  id: string;
  status: 'generating' | 'completed';
  content: string;  // 增量内容
  metadata?: {
    title?: string;
    tags?: string[];
    images?: string[];
  };
}
```

---

## 四、API设计

### 4.1 物料管理API

```typescript
// 上传物料
POST /api/projects/{projectId}/materials
Body: FormData (files)
Response: { taskIds: string[] }

// 查询解析状态
GET /api/materials/tasks/{taskId}
Response: ParseTask

// 获取物料列表
GET /api/projects/{projectId}/materials
Query: { type?, category?, page?, limit? }
Response: { materials: Material[], total: number }

// 更新物料信息
PATCH /api/materials/{materialId}
Body: { category?, parsedContent? }

// 删除物料
DELETE /api/materials/{materialId}
```

### 4.2 内容生成API

```typescript
// 生成内容
POST /api/projects/{projectId}/generate
Body: GenerateRequest
Response: SSE stream of GenerateResponse

// 获取生成历史
GET /api/projects/{projectId}/contents
Query: { type?, page?, limit? }
Response: { contents: GeneratedContent[], total: number }

// 重新生成
POST /api/contents/{contentId}/regenerate
Body: { style?: ContentStyle }
Response: SSE stream of GenerateResponse
```

---

## 五、技术实现要点

### 5.1 大文件处理

```typescript
// 分片上传
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadLargeFile(file: File, projectId: string) {
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = await initMultipartUpload(projectId, file.name);

  for (let i = 0; i < chunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await uploadChunk(uploadId, i, chunk);
  }

  return await completeUpload(uploadId);
}
```

### 5.2 解析任务队列

```typescript
// 使用队列处理解析任务，避免阻塞
class ParseQueue {
  private queue: ParseTask[] = [];
  private processing = false;

  async add(task: ParseTask) {
    this.queue.push(task);
    if (!this.processing) {
      this.process();
    }
  }

  private async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await this.executeTask(task);
    }
    this.processing = false;
  }
}
```

### 5.3 流式内容生成

```typescript
// 使用SSE实现流式输出
async function* generateContent(request: GenerateRequest) {
  const context = await buildContext(request.projectId);
  const prompt = buildPrompt(request, context);

  const stream = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }],
    stream: true
  });

  for await (const chunk of stream) {
    yield {
      status: 'generating',
      content: chunk.delta?.text || ''
    };
  }

  yield { status: 'completed', content: '' };
}
```

---

