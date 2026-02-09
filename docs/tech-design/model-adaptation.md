# 多模型适配系统

> 返回 [技术设计总览](../TECHNICAL_DESIGN.md)

## 六、多模型适配系统

参考 openclaw 项目的多模型架构设计，YiYi 支持多种 AI 模型提供商，并具备智能故障转移能力。

### 6.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层                                  │
│         物料解析 / 内容生成 / 智能问答                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   模型路由层                                 │
│  - 模型选择（别名 / ThinkLevel）                             │
│  - 故障转移（runWithModelFallback）                          │
│  - auth-profile 冷却                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Anthropic   │  │   OpenAI     │  │   其他提供商  │
│  Claude系列  │  │   GPT系列    │  │  Gemini/通义 │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 6.2 支持的模型提供商

| 提供商 | 模型 | API类型 | 适用场景 |
|--------|------|---------|----------|
| **Anthropic** | Claude 4/4.5 | anthropic-messages | 主力模型，内容生成 |
| **OpenAI** | GPT-4o/5 | openai-completions | 备用模型 |
| **OpenAI** | o3/o4-mini | openai-responses | 推理模型 |
| **Google** | Gemini Pro | google-generative-ai | 多模态解析 |
| **AWS Bedrock** | Claude/Titan | bedrock-converse-stream | 企业级部署 |
| **GitHub Copilot** | GPT 系列 | github-copilot | Copilot 集成 |
| **阿里云** | 通义千问 | openai-completions | 国内备用 |
| **本地模型** | Ollama/LMStudio | openai-completions | 离线使用 |

### 6.3 核心类型定义

#### ModelApi 类型

对齐 openclaw `types.models.ts`：

```typescript
type ModelApi =
  | "openai-completions"       // OpenAI Chat Completions 兼容
  | "openai-responses"         // OpenAI Responses API (o3/o4-mini 等)
  | "anthropic-messages"       // Anthropic Messages API
  | "google-generative-ai"    // Google Generative AI
  | "github-copilot"          // GitHub Copilot
  | "bedrock-converse-stream"; // AWS Bedrock Converse Stream
```

#### ModelProviderAuthMode 类型

```typescript
type ModelProviderAuthMode = "api-key" | "aws-sdk" | "oauth" | "token";
```

#### ModelDefinitionConfig 接口

```typescript
type ModelDefinitionConfig = {
  id: string;                     // 模型ID，如 "claude-sonnet-4-20250514"
  name: string;                   // 显示名称
  api?: ModelApi;                 // 可覆盖 provider 级别的 api 类型
  reasoning: boolean;             // 是否为推理模型
  input: Array<"text" | "image">; // 支持的输入类型
  cost: {
    input: number;                // 输入 token 单价 ($/1M tokens)
    output: number;               // 输出 token 单价
    cacheRead: number;            // 缓存读取单价
    cacheWrite: number;           // 缓存写入单价
  };
  contextWindow: number;          // 上下文窗口大小
  maxTokens: number;              // 最大输出 token 数
  headers?: Record<string, string>; // 模型级自定义请求头
  compat?: ModelCompatConfig;     // 兼容性配置
};

type ModelCompatConfig = {
  supportsStore?: boolean;             // 是否支持 store 参数
  supportsDeveloperRole?: boolean;     // 是否支持 developer 角色
  supportsReasoningEffort?: boolean;   // 是否支持 reasoning_effort
  maxTokensField?: "max_completion_tokens" | "max_tokens"; // maxTokens 字段名
};
```

#### ModelProviderConfig 接口

```typescript
type ModelProviderConfig = {
  baseUrl: string;                    // API 端点
  apiKey?: string;                    // API 密钥
  auth?: ModelProviderAuthMode;       // 认证方式，默认 "api-key"
  api?: ModelApi;                     // 默认 API 类型
  headers?: Record<string, string>;   // 自定义请求头
  authHeader?: boolean;               // 是否在 header 中发送 auth
  models: ModelDefinitionConfig[];    // 支持的模型列表
};
```

#### ThinkLevel 类型

```typescript
type ThinkLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
```

#### 模型别名索引

```typescript
type ModelRef = {
  provider: string;
  model: string;
};

type ModelAliasIndex = {
  byAlias: Map<string, { alias: string; ref: ModelRef }>;
  byKey: Map<string, string[]>;
};

// 默认模型别名常量
const DEFAULT_MODEL_ALIASES = {
  default: "anthropic/claude-sonnet-4-20250514",
  fast: "anthropic/claude-haiku-4-5-20251001",
  smart: "anthropic/claude-opus-4-20250514",
} as const;
```

#### 配置文件示例

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

  // 图像模型（多模态）
  imageModel: {
    primary: "anthropic/claude-sonnet-4-20250514",
    fallbacks: ["google/gemini-pro-vision"],
  },

  // 模型别名与参数
  models: {
    "anthropic/claude-sonnet-4-20250514": { alias: "default" },
    "anthropic/claude-haiku-4-5-20251001": { alias: "fast" },
    "anthropic/claude-opus-4-20250514": { alias: "smart" },
  },

  // 提供商配置
  providers: {
    anthropic: {
      baseUrl: "https://api.anthropic.com",
      apiKey: "${ANTHROPIC_API_KEY}",
      api: "anthropic-messages",
      models: [
        {
          id: "claude-sonnet-4-20250514",
          name: "Claude Sonnet 4",
          reasoning: false,
          input: ["text", "image"],
          cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
          contextWindow: 200000,
          maxTokens: 8192,
        },
      ],
    },
    openai: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "${OPENAI_API_KEY}",
      api: "openai-completions",
      models: [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          reasoning: false,
          input: ["text", "image"],
          cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
          contextWindow: 128000,
          maxTokens: 16384,
        },
      ],
    },
    qwen: {
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "${QWEN_API_KEY}",
      api: "openai-completions",
      models: [],
    },
    local: {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      models: [],
    },
  },
}
```

### 6.4 故障转移机制

参考 openclaw `model-fallback.ts` 的 `runWithModelFallback` 模式。

#### FailoverError 与错误分类

```typescript
type FailoverReason = "auth" | "format" | "rate_limit" | "billing" | "timeout" | "unknown";

class FailoverError extends Error {
  readonly reason: FailoverReason;
  readonly provider?: string;
  readonly model?: string;
  readonly profileId?: string;
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    params: {
      reason: FailoverReason;
      provider?: string;
      model?: string;
      profileId?: string;
      status?: number;
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: params.cause });
    this.name = "FailoverError";
    this.reason = params.reason;
    this.provider = params.provider;
    this.model = params.model;
    this.profileId = params.profileId;
    this.status = params.status;
    this.code = params.code;
  }
}

// 根据 HTTP 状态码和错误信息自动分类故障原因
function resolveFailoverReasonFromError(err: unknown): FailoverReason | null {
  const status = getStatusCode(err);
  if (status === 402) return "billing";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status === 408) return "timeout";
  if (status === 400) return "format";

  const code = (getErrorCode(err) ?? "").toUpperCase();
  if (["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET", "ECONNABORTED"].includes(code)) {
    return "timeout";
  }
  return null;
}
```

#### runWithModelFallback 核心实现

```typescript
type FallbackAttempt = {
  provider: string;
  model: string;
  error: string;
  reason?: FailoverReason;
  status?: number;
  code?: string;
};

async function runWithModelFallback<T>(params: {
  config: YiYiConfig;
  provider: string;
  model: string;
  fallbacksOverride?: string[];
  run: (provider: string, model: string) => Promise<T>;
  onError?: (attempt: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
}): Promise<{
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
}> {
  const candidates = resolveFallbackCandidates(params);
  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    // 检查 auth-profile 冷却状态
    if (isProviderInCooldown(candidate.provider)) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: `Provider ${candidate.provider} is in cooldown`,
        reason: "rate_limit",
      });
      continue;
    }

    try {
      const result = await params.run(candidate.provider, candidate.model);
      return { result, provider: candidate.provider, model: candidate.model, attempts };
    } catch (err) {
      // AbortError 不走 fallback，直接抛出
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }

      const normalized = coerceToFailoverError(err, candidate);
      if (!isFailoverError(normalized)) {
        throw err; // 非可恢复错误，直接抛出
      }

      lastError = normalized;
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: normalized.message,
        reason: normalized.reason,
        status: normalized.status,
        code: normalized.code,
      });

      // auth/billing 错误：冷却该 provider
      if (normalized.reason === "auth" || normalized.reason === "billing") {
        setCooldown(candidate.provider, 30 * 60 * 1000); // 30 分钟
      }

      await params.onError?.({
        provider: candidate.provider,
        model: candidate.model,
        error: normalized,
        attempt: i + 1,
        total: candidates.length,
      });
    }
  }

  // 所有模型都失败
  if (attempts.length <= 1 && lastError) {
    throw lastError;
  }
  const summary = attempts
    .map((a) => `${a.provider}/${a.model}: ${a.error}${a.reason ? ` (${a.reason})` : ""}`)
    .join(" | ");
  throw new Error(`All models failed (${attempts.length}): ${summary}`, {
    cause: lastError instanceof Error ? lastError : undefined,
  });
}
```

#### auth-profile 冷却机制

```typescript
const cooldownMap = new Map<string, number>(); // provider -> 冷却结束时间

function setCooldown(provider: string, durationMs: number): void {
  cooldownMap.set(provider, Date.now() + durationMs);
}

function isProviderInCooldown(provider: string): boolean {
  const until = cooldownMap.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldownMap.delete(provider);
    return false;
  }
  return true;
}
```

### 6.5 认证管理

#### 支持的认证方式

```typescript
// 1. API Key 认证（最常用）
interface ApiKeyAuth {
  type: "api-key";
  key: string;
}

// 2. AWS SDK 认证（Bedrock）
interface AwsSdkAuth {
  type: "aws-sdk";
  region: string;
  // 使用 AWS 默认凭证链（环境变量、配置文件、IAM 角色等）
}

// 3. OAuth 认证（支持自动刷新）
interface OAuthAuth {
  type: "oauth";
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId?: string;
}

// 4. 静态 Token 认证
interface TokenAuth {
  type: "token";
  token: string;
  expiresAt?: number;
}
```

#### 认证配置存储

```typescript
// ~/.yiyi/auth.json（加密存储）
interface AuthStore {
  version: number;
  profiles: {
    [profileId: string]: {
      provider: string;
      credential: ApiKeyAuth | OAuthAuth | TokenAuth;
      email?: string;
      createdAt: number;
      lastUsed?: number;
    };
  };
  // 每个提供商的认证顺序
  order?: {
    [provider: string]: string[];
  };
}
```

#### OAuth 自动刷新

```typescript
async function ensureValidToken(profile: OAuthProfile): Promise<string> {
  // 检查是否即将过期（提前5分钟刷新）
  if (profile.expiresAt - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshOAuthToken(profile);
    await updateAuthStore(profile.id, newTokens);
    return newTokens.accessToken;
  }
  return profile.accessToken;
}
```

### 6.6 模型选择与思考级别

#### 模型选择器

```typescript
interface ModelSelector {
  // 解析模型引用 "provider/model" → { provider, model }
  parseRef(ref: string): ModelRef | null;

  // 通过别名获取模型
  getByAlias(alias: string): ModelRef | null;

  // 构建别名索引
  buildAliasIndex(): ModelAliasIndex;

  // 获取推荐模型（根据任务类型）
  getRecommended(task: TaskType): ModelRef;

  // 列出可用模型
  listAvailable(): ModelRef[];
}

type TaskType =
  | "content_generation"  // 内容生成 - 需要创意
  | "data_extraction"     // 数据提取 - 需要准确
  | "image_analysis"      // 图像分析 - 需要多模态
  | "quick_query";        // 快速查询 - 需要速度
```

#### ThinkLevel 思考级别

控制推理模型的思考深度：

```typescript
type ThinkLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

function normalizeThinkLevel(raw?: string | null): ThinkLevel | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  if (["off"].includes(key)) return "off";
  if (["min", "minimal"].includes(key)) return "minimal";
  if (["low"].includes(key)) return "low";
  if (["mid", "med", "medium"].includes(key)) return "medium";
  if (["high", "max"].includes(key)) return "high";
  if (["xhigh", "extrahigh"].includes(key)) return "xhigh";
  return undefined;
}

function listThinkingLevels(provider?: string, model?: string): ThinkLevel[] {
  const levels: ThinkLevel[] = ["off", "minimal", "low", "medium", "high"];
  if (supportsXHighThinking(provider, model)) {
    levels.push("xhigh");
  }
  return levels;
}
```

#### 任务级模型配置

```typescript
// 不同任务使用不同模型
const taskModelMapping = {
  // 内容生成：使用主力模型
  content_generation: 'default',

  // 数据提取：使用准确模型
  data_extraction: 'smart',

  // 快速查询：使用快速模型
  quick_query: 'fast',

  // 图像分析：使用多模态模型
  image_analysis: 'imageModel'
};
```

### 6.7 模型管理 API

```typescript
// 获取当前模型配置
GET /api/models/config
Response: ModelConfig

// 更新模型配置
PATCH /api/models/config
Body: Partial<ModelConfig>

// 列出可用模型
GET /api/models/available
Response: { models: ModelInfo[] }

// 测试模型连接
POST /api/models/test
Body: { provider: string, model: string }
Response: { success: boolean, latency: number, error?: string }

// 获取模型使用统计
GET /api/models/stats
Response: {
  usage: { [model: string]: { calls: number, tokens: number } },
  errors: { [model: string]: { count: number, lastError: string } }
}
```

### 6.8 本地模型支持

支持通过 Ollama 或 LMStudio 运行本地模型，实现离线使用。

```typescript
// 本地模型配置
const localProvider: ProviderConfig = {
  local: {
    baseUrl: 'http://localhost:11434/v1',  // Ollama 默认端口
    api: 'openai-completions',
    models: [
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B' },
      { id: 'llava:13b', name: 'LLaVA 13B (多模态)' }
    ]
  }
};

// 自动检测本地模型
async function discoverLocalModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const { models } = await response.json();
    return models.map(m => ({
      id: m.name,
      provider: 'local',
      size: m.size,
      modifiedAt: m.modified_at
    }));
  } catch {
    return []; // 本地服务未运行
  }
}
```

