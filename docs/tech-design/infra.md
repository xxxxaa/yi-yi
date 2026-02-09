# 基础设施设计

> 返回 [技术设计总览](../TECHNICAL_DESIGN.md)

## 十六、认证授权系统

### 16.1 认证流程

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│  用户登录  │───▶│  验证手机号   │───▶│  发送验证码   │
└──────────┘    └──────────────┘    └──────┬───────┘
                                          │
                                          ▼
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│  返回Token│◀──│  生成JWT     │◀──│  验证码校验   │
└──────────┘    └──────────────┘    └──────────────┘
```

### 16.2 JWT Token管理

```typescript
interface JWTPayload {
  userId: string;
  role: 'agent' | 'team_leader' | 'admin';
  teamId?: string;
  iat: number;
  exp: number;
}

// Token配置
const tokenConfig = {
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: '2h',
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
  }
};

// 生成Token对
function generateTokenPair(user: User): TokenPair {
  const payload: JWTPayload = {
    userId: user.id,
    role: user.role,
    teamId: user.teamId,
    iat: Math.floor(Date.now() / 1000),
    exp: 0, // 由jwt.sign设置
  };

  return {
    accessToken: jwt.sign(payload, tokenConfig.accessToken.secret,
      { expiresIn: tokenConfig.accessToken.expiresIn }),
    refreshToken: jwt.sign(payload, tokenConfig.refreshToken.secret,
      { expiresIn: tokenConfig.refreshToken.expiresIn }),
  };
}
```

### 16.3 RBAC权限控制

```typescript
type Role = 'agent' | 'team_leader' | 'admin';

const permissions: Record<Role, string[]> = {
  agent: [
    'project:read', 'project:create', 'project:update',
    'material:read', 'material:upload',
    'content:generate', 'content:read',
    'customer:read', 'customer:create', 'customer:update',
    'tour:read', 'tour:create', 'tour:update',
    'profile:read', 'profile:update',
    'calculator:use', 'query:use',
  ],
  team_leader: [
    // 继承agent所有权限
    'team:read', 'team:manage',
    'agent:read',                    // 查看团队成员数据
    'report:team',                   // 团队报表
  ],
  admin: [
    // 继承所有权限
    'user:manage', 'system:config',
    'report:all',
  ],
};

// 权限中间件
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JWTPayload;
    const rolePerms = getAllPermissions(user.role);
    if (!rolePerms.includes(permission)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}
```

### 16.4 数据隔离

```typescript
// 经纪人只能访问自己的数据
function scopeToAgent(query: any, userId: string): any {
  return { ...query, where: { ...query.where, agentId: userId } };
}

// 团队长可以访问团队数据
function scopeToTeam(query: any, teamId: string): any {
  return { ...query, where: { ...query.where, agent: { teamId } } };
}
```

### 16.5 API接口

```typescript
// 发送验证码
POST /api/auth/sms-code
Body: { phone: string }

// 验证码登录
POST /api/auth/login
Body: { phone: string; code: string }
Response: { accessToken: string; refreshToken: string; user: User }

// 刷新Token
POST /api/auth/refresh
Body: { refreshToken: string }
Response: { accessToken: string; refreshToken: string }

// 退出登录
POST /api/auth/logout
```

---

## 十七、错误处理策略

参考 openclaw `src/infra/errors.ts` 极简设计。CLI + Gateway 架构无需 Express 中间件和复杂错误码枚举。

### 17.1 核心工具函数

仅需 3 个工具函数处理所有错误场景：

```typescript
// src/core/infra/errors.ts

/**
 * 从 Error 对象中提取错误码（string 或 number）
 */
export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return undefined;
}

/**
 * 将任意错误转为用户可读的消息字符串
 */
export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || "Error";
  }
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}

/**
 * 格式化未捕获的异常，保留 stack 信息
 * 对 INVALID_CONFIG 错误只返回 message（用户可操作）
 */
export function formatUncaughtError(err: unknown): string {
  if (extractErrorCode(err) === "INVALID_CONFIG") {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    return err.stack ?? err.message ?? err.name;
  }
  return formatErrorMessage(err);
}
```

### 17.2 CLI / Gateway 错误兜底

#### CLI 进程

```typescript
// src/cli/entry.ts
process.on("uncaughtException", (err) => {
  const message = formatUncaughtError(err);
  logger.fatal({ err: message }, "Uncaught exception in CLI");
  console.error(`\n错误: ${message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = formatUncaughtError(reason);
  logger.error({ err: message }, "Unhandled rejection in CLI");
  console.error(`\n未处理的异步错误: ${message}`);
});
```

#### Gateway 服务

```typescript
// src/gateway/server.ts
process.on("uncaughtException", (err) => {
  const message = formatUncaughtError(err);
  logger.fatal({ err: message }, "Uncaught exception in Gateway");
});

process.on("unhandledRejection", (reason) => {
  const message = formatUncaughtError(reason);
  logger.error({ err: message }, "Unhandled rejection in Gateway");
});

// WebSocket 错误帧
function sendWsError(ws: WebSocket, id: string, err: unknown) {
  ws.send(JSON.stringify({
    id,
    error: { code: extractErrorCode(err) ?? "INTERNAL", message: formatErrorMessage(err) },
  }));
}

// HTTP JSON 错误响应
function sendHttpError(res: ServerResponse, status: number, err: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    error: { code: extractErrorCode(err) ?? "INTERNAL", message: formatErrorMessage(err) },
  }));
}
```

### 17.3 AI 服务降级

AI 服务降级直接复用第六章的 `runWithModelFallback` 机制，不再单独实现 `callWithFallback`。

---

## 十八、限流与缓存策略

YiYi Gateway 作为本地服务进程，不需要 Redis 等外部缓存服务。所有限流和缓存均采用进程内方案。

### 18.1 进程内滑动窗口限流

```typescript
// src/core/infra/rate-limit.ts

interface RateLimitConfig {
  windowMs: number;             // 时间窗口（毫秒）
  maxRequests: number;          // 最大请求数
}

const rateLimits: Record<string, RateLimitConfig> = {
  // 内容生成限流（消耗 AI 资源）
  contentGeneration: {
    windowMs: 60 * 1000,        // 1 分钟
    maxRequests: 10,
  },
  // 查询限流
  query: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
};

// 进程内滑动窗口（Map + 定时清理）
class SlidingWindowLimiter {
  private windows = new Map<string, number[]>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // 每 5 分钟清理过期条目
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const timestamps = this.windows.get(key) ?? [];

    // 移除窗口外的记录
    const valid = timestamps.filter((t) => t > windowStart);

    if (valid.length >= config.maxRequests) {
      this.windows.set(key, valid);
      return { allowed: false, remaining: 0 };
    }

    valid.push(now);
    this.windows.set(key, valid);
    return { allowed: true, remaining: config.maxRequests - valid.length };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.windows) {
      const valid = timestamps.filter((t) => t > now - 10 * 60 * 1000);
      if (valid.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, valid);
      }
    }
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
  }
}
```

### 18.2 AI 配额管理

配额数据存储在 SQLite 中，通过查询统计用量：

```typescript
interface QuotaPlan {
  plan: "free" | "basic" | "pro" | "enterprise";
  daily: {
    contentGeneration: number;  // 内容生成次数（-1 表示无限）
    queryCount: number;         // 查询次数
    matchCount: number;         // 匹配次数
  };
  monthly: {
    totalTokens: number;        // 总 Token 数
    pptGeneration: number;      // PPT 生成次数
    posterGeneration: number;   // 海报生成次数
  };
}

const quotaPlans: Record<string, QuotaPlan> = {
  free:       { plan: "free",       daily: { contentGeneration: 5,   queryCount: 20,  matchCount: 5  }, monthly: { totalTokens: 100000,    pptGeneration: 2,   posterGeneration: 5  } },
  basic:      { plan: "basic",      daily: { contentGeneration: 30,  queryCount: 100, matchCount: 20 }, monthly: { totalTokens: 1000000,   pptGeneration: 20,  posterGeneration: 50 } },
  pro:        { plan: "pro",        daily: { contentGeneration: 100, queryCount: 500, matchCount: 50 }, monthly: { totalTokens: 5000000,   pptGeneration: 100, posterGeneration: 200 } },
  enterprise: { plan: "enterprise", daily: { contentGeneration: -1,  queryCount: -1,  matchCount: -1 }, monthly: { totalTokens: -1,        pptGeneration: -1,  posterGeneration: -1 } },
};

// 基于 SQLite 的配额检查
async function checkQuota(db: DatabaseSync, userId: string, action: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM usage_logs
    WHERE user_id = ? AND action = ? AND date(created_at) = ?
  `);
  const row = stmt.get(userId, action, today) as { count: number };

  const user = db.prepare("SELECT plan FROM users WHERE id = ?").get(userId) as { plan: string };
  const plan = quotaPlans[user.plan];
  const limit = plan.daily[action as keyof typeof plan.daily];

  if (limit === -1) return true; // 无限制
  return row.count < limit;
}
```

### 18.3 本地缓存策略

采用 SQLite 缓存表 + 内存 LRU 二级缓存：

```typescript
// src/core/infra/cache.ts

// 内存 LRU 缓存（热数据）
class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // 移到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      // 删除最早的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

// SQLite 缓存表（持久化）
const CACHE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS cache_entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )
`;

// 二级缓存读取
async function cacheGet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // L1: 内存 LRU
  const memCached = memoryCache.get(key);
  if (memCached !== undefined) return memCached as T;

  // L2: SQLite
  const row = db.prepare(
    "SELECT value FROM cache_entries WHERE key = ? AND expires_at > unixepoch()"
  ).get(key) as { value: string } | undefined;

  if (row) {
    const parsed = JSON.parse(row.value) as T;
    memoryCache.set(key, parsed, ttlMs);
    return parsed;
  }

  // 缓存未命中，执行 fetcher
  const data = await fetcher();
  memoryCache.set(key, data, ttlMs);
  db.prepare(
    "INSERT OR REPLACE INTO cache_entries (key, value, expires_at) VALUES (?, ?, unixepoch() + ?)"
  ).run(key, JSON.stringify(data), Math.ceil(ttlMs / 1000));
  return data;
}
```

缓存策略配置：

```typescript
const cacheConfigs = {
  projectInfo:  { ttlMs: 3600 * 1000 },   // 楼盘信息：1 小时
  houseTypes:   { ttlMs: 3600 * 1000 },   // 户型信息：1 小时
  matchResults: { ttlMs: 300 * 1000 },    // 匹配结果：5 分钟
  lprRate:      { ttlMs: 86400 * 1000 },  // LPR 利率：24 小时
  quickReplies: { ttlMs: 1800 * 1000 },   // 快捷回复：30 分钟
} as const;
```

---

