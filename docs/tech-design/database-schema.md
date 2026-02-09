# 数据库 Schema 设计

> 返回 [技术设计总览](../TECHNICAL_DESIGN.md)

## 十九、完整数据库Schema

采用 Node 22 内置的 `node:sqlite` 模块（`DatabaseSync`），零外部依赖，无需 ORM。

### 19.0 数据库初始化与迁移

#### 连接管理

```typescript
// src/core/db/connection.ts
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export function getDatabase(dbPath: string): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    runMigrations(db);
  }
  return db;
}
```

#### Schema 迁移机制

采用 `schema_version` 表 + `ensureColumn` 模式，支持增量迁移：

```typescript
// src/core/db/migrations.ts

// schema_version 表记录当前版本
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);
`;

function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as { version: number };
  return row?.version ?? 0;
}

function setSchemaVersion(db: DatabaseSync, version: number): void {
  db.prepare("UPDATE schema_version SET version = ?, updated_at = datetime('now') WHERE id = 1").run(version);
}

// ensureColumn：安全地添加新列（已存在则跳过）
function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

// 迁移注册
type Migration = { version: number; up: (db: DatabaseSync) => void };

const migrations: Migration[] = [
  { version: 1, up: (db) => { /* 初始建表 */ createInitialTables(db); } },
  { version: 2, up: (db) => { /* 添加向量搜索 */ createEmbeddingsTable(db); } },
  { version: 3, up: (db) => { /* 添加全文搜索 */ createFTSTables(db); } },
  // 后续迁移追加到此数组
];

function runMigrations(db: DatabaseSync): void {
  db.exec(INIT_SQL);
  const current = getSchemaVersion(db);

  for (const migration of migrations) {
    if (migration.version > current) {
      migration.up(db);
      setSchemaVersion(db, migration.version);
    }
  }
}
```

### 19.1 用户表 (users)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'agent',       -- agent/team_leader/admin
  team_id TEXT,
  plan TEXT DEFAULT 'free',        -- free/basic/pro/enterprise
  plan_expires_at DATETIME,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_team ON users(team_id);
```

### 19.2 跟进记录表 (follow_up_records)

```sql
CREATE TABLE follow_up_records (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- call/wechat/tour/meeting/other
  content TEXT,
  result TEXT,
  next_action TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE INDEX idx_followup_customer ON follow_up_records(customer_id);
CREATE INDEX idx_followup_agent_date ON follow_up_records(agent_id, created_at);
```

### 19.3 经纪人IP表 (agent_profiles)

```sql
CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  nickname TEXT,
  cover_image TEXT,
  years_of_experience INTEGER DEFAULT 0,
  specialized_areas TEXT,           -- JSON数组
  specialized_types TEXT,           -- JSON数组
  total_deals INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  style TEXT DEFAULT 'professional',
  slogan TEXT,
  introduction TEXT,
  signature TEXT,
  opening_line TEXT,
  closing_line TEXT,
  watermark_config TEXT,            -- JSON
  qr_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 19.4 带看计划表 (tour_plans)

```sql
CREATE TABLE tour_plans (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  scheduled_at DATETIME,
  status TEXT DEFAULT 'planned',    -- planned/in_progress/completed/cancelled
  projects_config TEXT NOT NULL,    -- JSON: [{projectId, order, houseTypeIds, duration}]
  preparation TEXT,                 -- JSON: TourPreparation
  summary TEXT,                     -- JSON: TourSummary
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX idx_tour_agent_date ON tour_plans(agent_id, scheduled_at);
CREATE INDEX idx_tour_customer ON tour_plans(customer_id);
```

### 19.5 讲房话术表 (tour_scripts)

```sql
CREATE TABLE tour_scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene TEXT NOT NULL,              -- sandbox/showroom/garden/surrounding
  house_type_id TEXT,
  duration TEXT,                    -- short/standard/detailed
  sections TEXT NOT NULL,           -- JSON: 话术分段内容
  total_duration TEXT,
  agent_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE INDEX idx_script_project ON tour_scripts(project_id);
```

### 19.6 PPT任务表 (ppt_tasks)

```sql
CREATE TABLE ppt_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  template_id TEXT,
  options TEXT NOT NULL,            -- JSON: 生成选项
  status TEXT DEFAULT 'processing', -- processing/completed/failed
  progress INTEGER DEFAULT 0,
  result_pptx_url TEXT,
  result_pdf_url TEXT,
  preview_images TEXT,              -- JSON数组
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE INDEX idx_ppt_agent ON ppt_tasks(agent_id);
```

### 19.7 海报表 (posters)

```sql
CREATE TABLE posters (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- deal/monthly/testimonial
  data TEXT NOT NULL,               -- JSON: 海报数据
  template_id TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE INDEX idx_poster_agent ON posters(agent_id);
```

### 19.8 会话表 (conversations)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,            -- wechat/wecom/douyin/xiaohongshu/sms
  customer_id TEXT,
  external_user_id TEXT,            -- 渠道内用户ID
  external_user_name TEXT,
  last_message_at DATETIME,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',     -- active/archived
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX idx_conv_agent_channel ON conversations(agent_id, channel);
CREATE INDEX idx_conv_last_msg ON conversations(last_message_at DESC);
```

### 19.9 消息表 (messages)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  direction TEXT NOT NULL,          -- inbound/outbound
  sender_id TEXT,
  content_type TEXT NOT NULL,       -- text/image/voice/video/link
  content_text TEXT,
  content_media_url TEXT,
  content_metadata TEXT,            -- JSON
  status TEXT DEFAULT 'received',   -- received/read/replied/archived
  is_important BOOLEAN DEFAULT FALSE,
  reply_to_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
CREATE INDEX idx_msg_conv_date ON messages(conversation_id, created_at);
```

### 19.10 快捷回复表 (quick_replies)

```sql
CREATE TABLE quick_replies (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  category TEXT NOT NULL,           -- greeting/quote/tour/followup
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT,                   -- JSON数组
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE INDEX idx_reply_agent_cat ON quick_replies(agent_id, category);
```

### 19.11 提醒表 (reminders)

```sql
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- follow_up/tour/system
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',   -- high/medium/low
  scheduled_at DATETIME NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX idx_reminder_agent_date ON reminders(agent_id, scheduled_at);
CREATE INDEX idx_reminder_unread ON reminders(agent_id, is_read);
```

### 19.12 ER关系图

```
users ──1:N──▶ projects
users ──1:N──▶ customers
users ──1:1──▶ agent_profiles
users ──1:N──▶ tour_plans
users ──1:N──▶ conversations

projects ──1:N──▶ house_types
projects ──1:N──▶ materials
projects ──1:N──▶ generated_contents
projects ──1:N──▶ tour_scripts
projects ──1:N──▶ ppt_tasks

customers ──1:N──▶ follow_up_records
customers ──1:N──▶ tour_plans
customers ──1:N──▶ conversations
customers ──1:N──▶ reminders

conversations ──1:N──▶ messages

materials ──1:N──▶ embeddings (向量索引)
projects ──FTS5──▶ projects_fts (全文搜索)
materials ──FTS5──▶ materials_fts (全文搜索)
```

### 19.13 向量搜索支持（sqlite-vec）

使用 sqlite-vec 扩展实现本地向量检索，替代外部向量数据库：

```sql
-- 向量嵌入表
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,       -- 'material' | 'project' | 'customer'
  source_id TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,   -- 分块索引
  chunk_text TEXT,                  -- 原始文本块
  embedding BLOB NOT NULL,         -- 向量数据 (float32 数组)
  dimensions INTEGER NOT NULL,     -- 向量维度
  model TEXT,                      -- 生成向量的模型
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_emb_source ON embeddings(source_type, source_id);
```

```typescript
// sqlite-vec 向量搜索
import * as sqliteVec from "sqlite-vec";

function initVectorSearch(db: DatabaseSync): void {
  sqliteVec.load(db);
  // 创建虚拟表用于 KNN 搜索
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_materials USING vec0(
      embedding float[1536]
    );
  `);
}

// 向量相似度搜索
function searchSimilar(
  db: DatabaseSync,
  queryEmbedding: Float32Array,
  topK: number = 10,
): Array<{ rowid: number; distance: number }> {
  const stmt = db.prepare(`
    SELECT rowid, distance
    FROM vec_materials
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `);
  return stmt.all(queryEmbedding, topK) as Array<{ rowid: number; distance: number }>;
}
```

### 19.14 全文搜索支持（FTS5）

使用 SQLite 内置 FTS5 实现中文全文搜索：

```sql
-- 楼盘全文搜索
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
  name,
  district,
  address,
  description,
  content='projects',
  content_rowid='rowid'
);

-- 物料全文搜索
CREATE VIRTUAL TABLE IF NOT EXISTS materials_fts USING fts5(
  file_name,
  parsed_content,
  content='materials',
  content_rowid='rowid'
);
```

```typescript
// FTS5 搜索工具函数
function fullTextSearch(
  db: DatabaseSync,
  table: string,
  query: string,
  limit: number = 20,
): Array<{ rowid: number; rank: number }> {
  const stmt = db.prepare(`
    SELECT rowid, rank
    FROM ${table}_fts
    WHERE ${table}_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  return stmt.all(query, limit) as Array<{ rowid: number; rank: number }>;
}

// 同步触发器：在数据写入时自动更新 FTS 索引
function createFTSTriggers(db: DatabaseSync, table: string, columns: string[]): void {
  const colList = columns.join(", ");
  const newColList = columns.map((c) => `new.${c}`).join(", ");

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ${table}_fts_insert AFTER INSERT ON ${table} BEGIN
      INSERT INTO ${table}_fts(rowid, ${colList}) VALUES (new.rowid, ${newColList});
    END;

    CREATE TRIGGER IF NOT EXISTS ${table}_fts_delete AFTER DELETE ON ${table} BEGIN
      INSERT INTO ${table}_fts(${table}_fts, rowid, ${colList}) VALUES ('delete', old.rowid, ${columns.map((c) => `old.${c}`).join(", ")});
    END;

    CREATE TRIGGER IF NOT EXISTS ${table}_fts_update AFTER UPDATE ON ${table} BEGIN
      INSERT INTO ${table}_fts(${table}_fts, rowid, ${colList}) VALUES ('delete', old.rowid, ${columns.map((c) => `old.${c}`).join(", ")});
      INSERT INTO ${table}_fts(rowid, ${colList}) VALUES (new.rowid, ${newColList});
    END;
  `);
}
```
