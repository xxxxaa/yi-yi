# YiYi 技术设计文档

## 一、物料解析系统

### 1.1 解析流程架构

```
┌─────────────────────────────────────────────────────────────┐
│                      物料上传入口                            │
│         拖拽上传 / 文件选择 / 批量导入                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      文件预处理                              │
│  - 格式检测                                                 │
│  - 文件校验                                                 │
│  - 临时存储                                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      类型路由器                              │
│  根据文件类型分发到对应的解析器                              │
└────┬─────────┬─────────┬─────────┬─────────┬───────────────┘
     │         │         │         │         │
     ▼         ▼         ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│PDF解析 ││图片解析││视频解析││音频解析││表格解析│
│  器    ││  器    ││  器    ││  器    ││  器    │
└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │         │
     └─────────┴─────────┴────┬────┴─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI 信息提取                               │
│  - 结构化信息提取                                           │
│  - 卖点识别                                                 │
│  - 关键数据抽取                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据存储                                  │
│  - 文件存储                                                 │
│  - 结构化数据入库                                           │
│  - 向量索引构建                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 各类型解析器详细设计

#### 1.2.1 PDF解析器

**输入**: PDF文件（楼书、户型册、价格表等）

**处理流程**:
```
1. PDF解析
   - 使用 pdf-parse 提取文本
   - 使用 pdf2pic 提取图片
   - 识别表格结构

2. 内容分类
   - 封面信息
   - 楼盘介绍
   - 户型页面
   - 配套说明
   - 价格信息

3. AI提取
   - 发送给Claude进行结构化提取
   - 返回JSON格式数据
```

**输出结构**:
```json
{
  "document_type": "楼书",
  "project_info": {
    "name": "xxx花园",
    "developer": "xxx地产",
    "address": "xxx路xxx号"
  },
  "house_types": [
    {
      "name": "A户型",
      "rooms": 3,
      "area": "89-95㎡",
      "features": ["南北通透", "主卧带飘窗"]
    }
  ],
  "facilities": {
    "traffic": ["地铁x号线xxx站"],
    "education": ["xxx小学"],
    "commercial": ["xxx商场"]
  },
  "images": [
    {"type": "效果图", "path": "xxx.jpg"},
    {"type": "户型图", "path": "xxx.jpg"}
  ]
}
```

#### 1.2.2 图片解析器

**输入**: JPG/PNG图片（户型图、效果图、区位图等）

**处理流程**:
```
1. 图片分类（AI视觉识别）
   - 户型图 → 户型解析流程
   - 效果图 → 场景标签提取
   - 区位图 → 配套信息提取
   - 价格表图片 → OCR+表格解析

2. 户型图解析
   - OCR识别文字（面积、朝向、房间标注）
   - 识别房间布局
   - 提取户型特点

3. 效果图解析
   - 场景识别（客厅/卧室/外立面等）
   - 风格识别（现代/中式/欧式等）
   - 生成描述标签

4. 区位图解析
   - OCR识别地标名称
   - 识别距离信息
   - 提取配套列表
```

**户型图输出**:
```json
{
  "image_type": "户型图",
  "house_type": {
    "layout": "3室2厅2卫",
    "area": "95㎡",
    "orientation": "南北",
    "rooms": [
      {"name": "主卧", "area": "15㎡", "features": ["朝南", "带飘窗"]},
      {"name": "客厅", "area": "28㎡", "features": ["朝南", "连接阳台"]}
    ],
    "highlights": ["南北通透", "动静分离", "全明户型"]
  }
}
```

#### 1.2.3 视频解析器

**输入**: MP4/MOV视频（样板间视频、宣传片等）

**处理流程**:
```
1. 视频预处理
   - 提取音频轨道
   - 按间隔提取关键帧（每5秒）

2. 音频处理
   - Whisper语音转文字
   - 提取解说词内容

3. 关键帧分析
   - 场景识别
   - 文字OCR
   - 生成帧描述

4. 内容整合
   - 时间轴对齐
   - 生成视频摘要
```

**输出结构**:
```json
{
  "duration": "3:25",
  "transcript": "欢迎来到xxx花园样板间...",
  "scenes": [
    {"time": "0:00-0:30", "scene": "外立面", "description": "现代简约风格外立面"},
    {"time": "0:30-1:20", "scene": "客厅", "description": "挑高客厅，落地窗设计"}
  ],
  "key_points": [
    "精装交付",
    "270°环幕客厅",
    "主卧套房设计"
  ]
}
```

#### 1.2.4 表格解析器

**输入**: Excel/CSV/图片表格（价格表、房源表等）

**处理流程**:
```
1. 格式处理
   - Excel: xlsx库直接解析
   - 图片: OCR + 表格结构识别

2. 表格结构化
   - 识别表头
   - 解析数据行
   - 数据类型推断

3. 语义理解
   - AI理解表格含义
   - 字段映射到标准结构
```

**价格表输出**:
```json
{
  "table_type": "价格表",
  "update_date": "2026-02-01",
  "units": [
    {
      "building": "1栋",
      "unit": "1单元",
      "floor": 15,
      "room": "1501",
      "house_type": "A户型",
      "area": 95.5,
      "unit_price": 25000,
      "total_price": 2387500,
      "status": "在售"
    }
  ]
}
```

### 1.3 AI提取Prompt设计

#### 楼盘信息提取Prompt

```
你是一个专业的房产信息提取助手。请从以下内容中提取楼盘信息，以JSON格式返回。

需要提取的信息：
1. 楼盘基础信息（名称、开发商、地址、物业类型、产权年限、交房时间）
2. 户型信息（户型名称、面积、朝向、价格、特点）
3. 配套信息（交通、教育、商业、医疗、休闲）
4. 核心卖点（3-5个最突出的卖点）

如果某项信息未提及，返回null。

内容：
{content}

请返回JSON格式：
```

#### 户型图解析Prompt

```
请分析这张户型图，提取以下信息：

1. 户型布局（几室几厅几卫）
2. 建筑面积
3. 朝向
4. 各房间信息（名称、大概面积、特点）
5. 户型亮点（如南北通透、动静分离等）

以JSON格式返回结果。
```

---

## 二、内容生成系统

### 2.1 生成流程架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户输入                                │
│  选择楼盘 → 选择内容类型 → 配置参数                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    物料检索                                  │
│  - 加载楼盘基础信息                                         │
│  - 检索相关物料                                             │
│  - 构建上下文                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prompt构建                                │
│  - 选择对应模板                                             │
│  - 注入楼盘信息                                             │
│  - 应用风格参数                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI生成                                    │
│  - 调用Claude API                                           │
│  - 流式输出                                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    后处理                                    │
│  - 格式化输出                                               │
│  - 敏感词检查                                               │
│  - 保存记录                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 内容模板设计

#### 2.2.1 小红书推文模板

**模板结构**:
```yaml
template_id: xiaohongshu_tanpan
name: 探盘笔记
description: 以第一人称探盘视角的种草笔记

structure:
  title:
    format: "emoji + 吸睛标题"
    max_length: 20
    examples:
      - "🏠发现宝藏楼盘！{area}刚需福音"
      - "💰总价{price}万上车{city}地铁房"

  body:
    sections:
      - name: 开场
        description: 引入话题，制造好奇
        length: 50-100字

      - name: 楼盘介绍
        description: 位置、开发商、基本信息
        length: 100-150字

      - name: 户型分析
        description: 主推户型详细介绍
        length: 150-200字

      - name: 配套说明
        description: 交通、学校、商业等
        length: 100-150字

      - name: 价格信息
        description: 价格区间、性价比分析
        length: 50-100字

      - name: 总结建议
        description: 适合人群、购买建议
        length: 50-100字

  tags:
    count: 5-10
    categories:
      - 城市标签: "#上海买房"
      - 区域标签: "#浦东新房"
      - 需求标签: "#刚需上车"
      - 产品标签: "#地铁房"
```

**生成Prompt**:
```
你是一位专业的房产博主，擅长写小红书种草笔记。请根据以下楼盘信息，写一篇探盘笔记。

## 楼盘信息
{project_info}

## 写作要求
1. 标题要吸睛，包含emoji，突出核心卖点
2. 正文800-1200字，分段清晰
3. 语气亲切自然，像朋友分享
4. 突出以下卖点：{highlights}
5. 目标读者：{target_audience}
6. 风格：{style}

## 输出格式
标题：xxx
正文：xxx
标签：#xxx #xxx

请开始创作：
```

#### 2.2.2 短视频脚本模板

**模板结构**:
```yaml
template_id: video_script_30s
name: 30秒楼盘介绍
description: 适合抖音/视频号的短视频脚本

structure:
  duration: 30s

  scenes:
    - name: 开场hook
      duration: 3-5s
      content: 吸引注意力的开场白
      visual: 外立面/航拍

    - name: 楼盘定位
      duration: 5-8s
      content: 楼盘名称、位置、开发商
      visual: 区位图/沙盘

    - name: 核心卖点
      duration: 10-12s
      content: 2-3个核心卖点
      visual: 配套实景/效果图

    - name: 户型价格
      duration: 5-8s
      content: 主力户型和价格
      visual: 户型图/样板间

    - name: 结尾引导
      duration: 3-5s
      content: 行动号召
      visual: 联系方式/二维码

output_format:
  script: 完整口播文案
  subtitles: 分段字幕
  shot_list: 分镜建议
  bgm_suggestion: 背景音乐建议
```

**生成Prompt**:
```
你是一位专业的房产短视频编导。请根据以下楼盘信息，创作一个{duration}秒的短视频脚本。

## 楼盘信息
{project_info}

## 视频要求
1. 时长：{duration}秒
2. 平台：{platform}
3. 风格：{style}
4. 突出卖点：{highlights}

## 输出格式

### 口播文案
（完整的口播稿，标注时间节点）

### 分镜脚本
| 时间 | 画面 | 口播 | 字幕 |
|------|------|------|------|

### 拍摄建议
- 场景1：xxx
- 场景2：xxx

### BGM建议
风格：xxx
参考曲目：xxx

请开始创作：
```

#### 2.2.3 朋友圈文案模板

**模板结构**:
```yaml
template_id: moments_recommend
name: 房源推荐
description: 朋友圈房源推荐文案

structure:
  text:
    max_length: 200
    format: |
      【楼盘名称】简短介绍
      📍位置：xxx
      🏠户型：xxx
      💰价格：xxx
      ✨亮点：xxx

  images:
    count: 6-9
    order:
      - 效果图（封面）
      - 区位图
      - 户型图x2
      - 样板间x3
      - 配套实景
```

### 2.3 风格参数配置

```typescript
interface ContentStyle {
  // 语气风格
  tone: 'professional' | 'casual' | 'enthusiastic' | 'informative';

  // 目标受众
  audience: 'first_time_buyer' | 'upgrader' | 'investor' | 'elderly';

  // 内容侧重
  focus: 'price' | 'location' | 'quality' | 'education' | 'investment';

  // 是否包含价格
  includePrice: boolean;

  // emoji使用程度
  emojiLevel: 'none' | 'minimal' | 'moderate' | 'heavy';

  // 文案长度
  length: 'short' | 'medium' | 'long';
}
```

### 2.4 内容质量控制

#### 敏感词过滤
```typescript
const sensitiveWords = [
  // 违规承诺
  '保值', '增值', '投资回报', '稳赚',
  // 虚假宣传
  '第一', '最好', '绝无仅有', '独一无二',
  // 其他敏感词
  '学区房', '地铁房'  // 需要核实后使用
];
```

#### 内容审核流程
```
生成内容 → 敏感词检查 → 事实核对 → 人工确认 → 发布
```

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

## 六、多模型适配系统

参考 OpenClaw 项目的多模型架构设计，YiYi 支持多种 AI 模型提供商，并具备智能故障转移能力。

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
│  - 模型选择                                                 │
│  - 故障转移                                                 │
│  - 负载均衡                                                 │
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
| **Anthropic** | Claude 3.5/4 | anthropic-messages | 主力模型，内容生成 |
| **OpenAI** | GPT-4/4o | openai-completions | 备用模型 |
| **Google** | Gemini Pro | google-generative-ai | 多模态解析 |
| **阿里云** | 通义千问 | openai-compatible | 国内备用 |
| **本地模型** | Ollama/LMStudio | openai-compatible | 离线使用 |

### 6.3 配置结构设计

#### 模型配置

```typescript
interface ModelConfig {
  // 主模型配置
  model: {
    primary: string;        // 主模型 "provider/model"
    fallbacks?: string[];   // 故障转移列表
  };

  // 图像处理模型（用于户型图、效果图解析）
  imageModel?: {
    primary: string;
    fallbacks?: string[];
  };

  // 模型目录（可配置别名和参数）
  models?: {
    [key: string]: {
      alias?: string;       // 别名，如 "fast", "smart"
      params?: {            // 模型特定参数
        temperature?: number;
        maxTokens?: number;
      };
    };
  };
}
```

#### 提供商配置

```typescript
interface ProviderConfig {
  [providerId: string]: {
    baseUrl: string;                    // API端点
    apiKey?: string;                    // API密钥
    auth: 'api-key' | 'oauth' | 'token'; // 认证方式
    api: ModelApi;                      // API类型
    headers?: Record<string, string>;   // 自定义请求头
    models: ModelDefinition[];          // 支持的模型列表
  };
}

type ModelApi =
  | 'openai-completions'      // OpenAI 兼容
  | 'anthropic-messages'      // Anthropic 原生
  | 'google-generative-ai';   // Google AI
```

#### 配置文件示例

```json5
// ~/.yiyi/config.json
{
  // 模型配置
  "model": {
    "primary": "anthropic/claude-sonnet-4-20250514",
    "fallbacks": [
      "openai/gpt-4o",
      "qwen/qwen-max"
    ]
  },

  // 图像模型（多模态）
  "imageModel": {
    "primary": "anthropic/claude-sonnet-4-20250514",
    "fallbacks": ["google/gemini-pro-vision"]
  },

  // 模型别名
  "models": {
    "anthropic/claude-sonnet-4-20250514": { "alias": "default" },
    "anthropic/claude-3-5-haiku-20241022": { "alias": "fast" },
    "anthropic/claude-opus-4-20250514": { "alias": "smart" }
  },

  // 提供商配置
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}"
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}"
    },
    "qwen": {
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "apiKey": "${QWEN_API_KEY}",
      "api": "openai-completions"
    },
    "local": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions"
    }
  }
}
```

### 6.4 故障转移机制

#### 故障转移流程

```typescript
interface FailoverAttempt {
  provider: string;
  model: string;
  error: Error;
  reason: FailoverReason;
  timestamp: number;
}

type FailoverReason =
  | 'auth'        // 认证失败
  | 'rate_limit'  // 速率限制
  | 'timeout'     // 请求超时
  | 'billing'     // 计费问题
  | 'unavailable' // 服务不可用
  | 'unknown';    // 未知错误

async function runWithFallback<T>(
  task: (provider: string, model: string) => Promise<T>,
  config: ModelConfig
): Promise<T> {
  const candidates = [
    config.model.primary,
    ...(config.model.fallbacks || [])
  ];

  const attempts: FailoverAttempt[] = [];

  for (const candidate of candidates) {
    const [provider, model] = parseModelRef(candidate);

    // 检查冷却状态
    if (isInCooldown(provider)) {
      attempts.push({ provider, model, reason: 'cooldown', ... });
      continue;
    }

    try {
      const result = await task(provider, model);
      // 记录成功
      recordSuccess(provider);
      return result;
    } catch (error) {
      const reason = classifyError(error);
      attempts.push({ provider, model, error, reason, ... });

      // 根据错误类型决定是否继续
      if (reason === 'auth' || reason === 'billing') {
        // 认证/计费问题，进入冷却
        setCooldown(provider, 30 * 60 * 1000); // 30分钟
      }

      // 继续尝试下一个模型
      continue;
    }
  }

  // 所有模型都失败
  throw new AllModelsFailedError(attempts);
}
```

#### 冷却机制

```typescript
interface CooldownState {
  provider: string;
  until: number;        // 冷却结束时间
  reason: FailoverReason;
  failCount: number;    // 连续失败次数
}

// 冷却时间策略（指数退避）
function getCooldownDuration(failCount: number): number {
  const base = 60 * 1000; // 1分钟
  const max = 30 * 60 * 1000; // 最大30分钟
  return Math.min(base * Math.pow(2, failCount - 1), max);
}
```

### 6.5 认证管理

#### 支持的认证方式

```typescript
// 1. API Key 认证（最常用）
interface ApiKeyAuth {
  type: 'api-key';
  key: string;
}

// 2. OAuth 认证（支持自动刷新）
interface OAuthAuth {
  type: 'oauth';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId?: string;
}

// 3. 静态 Token 认证
interface TokenAuth {
  type: 'token';
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

### 6.6 运行时模型切换

#### 模型选择器

```typescript
interface ModelSelector {
  // 解析模型引用
  parseRef(ref: string): { provider: string; model: string };

  // 通过别名获取模型
  getByAlias(alias: string): ModelRef | null;

  // 获取推荐模型（根据任务类型）
  getRecommended(task: TaskType): ModelRef;

  // 列出可用模型
  listAvailable(): ModelRef[];
}

type TaskType =
  | 'content_generation'  // 内容生成 - 需要创意
  | 'data_extraction'     // 数据提取 - 需要准确
  | 'image_analysis'      // 图像分析 - 需要多模态
  | 'quick_query';        // 快速查询 - 需要速度
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

---

## 七、AI讲房系统

### 7.1 3S快速讲房

#### 生成逻辑

```typescript
interface ThreeSecondPitchRequest {
  projectId: string;
  emphasis: 'location' | 'price' | 'education' | 'quality' | 'layout';
  targetAudience: 'first_time' | 'upgrader' | 'investor';
  tone: 'professional' | 'friendly' | 'urgent';
  includePrice: boolean;
}

// 生成Prompt模板
const pitchPrompt = `
你是一位资深房产经纪人。请根据以下楼盘信息，生成一句3秒内能说完的快速推荐话术。

## 楼盘信息
{project_info}

## 要求
1. 话术结构：[楼盘定位] + [核心卖点] + [价格/行动引导]
2. 突出卖点：{emphasis}
3. 目标客群：{targetAudience}
4. 语气风格：{tone}
5. 字数限制：30-50字
6. ${includePrice ? '包含具体价格' : '不包含具体价格'}

## 示例
"XX花园，地铁口300米纯新盘，89平三房总价280万起，首付50万上车！"

请生成话术：
`;
```

### 7.2 AI讲房话术生成

#### 场景模板

```typescript
interface TourScriptRequest {
  projectId: string;
  scene: 'sandbox' | 'showroom' | 'garden' | 'surrounding';
  houseTypeId?: string;  // 样板间讲解需要指定户型
  duration: 'short' | 'standard' | 'detailed';
  includeQA: boolean;
}

// 沙盘讲解模板
const sandboxTemplate = {
  sections: [
    { name: '开场白', duration: '30s', required: true },
    { name: '区位介绍', duration: '1-2min', required: true },
    { name: '项目规划', duration: '1-2min', required: true },
    { name: '产品介绍', duration: '1min', required: true },
    { name: '过渡引导', duration: '15s', required: true }
  ]
};

// 样板间讲解模板
const showroomTemplate = {
  sections: [
    { name: '入户玄关', duration: '30s', required: true },
    { name: '客餐厅', duration: '1min', required: true },
    { name: '主卧', duration: '1min', required: true },
    { name: '次卧/书房', duration: '30s', required: false },
    { name: '厨卫', duration: '30s', required: true },
    { name: '阳台', duration: '30s', required: false },
    { name: '总结', duration: '30s', required: true }
  ]
};
```

#### 异议处理库

```typescript
interface ObjectionHandler {
  category: string;
  questions: {
    question: string;
    answer: string;
    tips: string[];
  }[];
}

const commonObjections: ObjectionHandler[] = [
  {
    category: '价格异议',
    questions: [
      {
        question: '价格太贵了',
        answer: '您说的对，这个价格确实不低。但您看...',
        tips: ['强调性价比', '对比周边', '分析升值空间']
      }
    ]
  },
  {
    category: '户型异议',
    questions: [
      {
        question: '这个户型有点小',
        answer: '面积确实紧凑，但空间利用率很高...',
        tips: ['强调得房率', '展示收纳设计', '对比同面积户型']
      }
    ]
  }
];
```

### 7.3 VR讲房

#### VR场景识别

```typescript
interface VRSceneAnalysis {
  sceneType: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony';
  features: string[];
  suggestedScript: string;
}

// 使用多模态模型分析VR截图
async function analyzeVRScene(imageUrl: string): Promise<VRSceneAnalysis> {
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: '分析这个VR看房场景，识别房间类型和特点，生成讲解词' }
      ]
    }]
  });
  return parseVRAnalysis(response);
}
```

#### 语音合成集成

```typescript
interface TTSConfig {
  provider: 'azure' | 'aliyun' | 'local';
  voice: string;
  speed: number;
  pitch: number;
}

async function generateVoiceNarration(
  script: string,
  config: TTSConfig
): Promise<string> {
  // 返回音频文件URL
  const audioUrl = await ttsService.synthesize(script, config);
  return audioUrl;
}
```

---

## 八、PPT生成系统

### 8.1 PPT生成架构

```
┌─────────────────────────────────────────────────────────────┐
│                      PPT生成请求                             │
│         楼盘ID / 模板类型 / 自定义选项                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据准备                                │
│  - 楼盘基础信息                                             │
│  - 户型数据                                                 │
│  - 物料资源（图片、图表）                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      内容生成                                │
│  - AI生成文案                                               │
│  - 数据可视化                                               │
│  - 布局规划                                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      PPT渲染                                 │
│  - 模板应用                                                 │
│  - 图片插入                                                 │
│  - 样式调整                                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      输出                                    │
│         PPTX / PDF / 图片序列                                │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 PPT模板系统

```typescript
interface PPTTemplate {
  id: string;
  name: string;
  description: string;
  pageCount: { min: number; max: number };
  style: 'simple' | 'business' | 'modern' | 'luxury';
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  pages: PPTPageTemplate[];
}

interface PPTPageTemplate {
  type: 'cover' | 'content' | 'image' | 'comparison' | 'contact';
  layout: string;
  placeholders: {
    id: string;
    type: 'text' | 'image' | 'chart' | 'table';
    position: { x: number; y: number; width: number; height: number };
    style?: Record<string, any>;
  }[];
}
```

### 8.3 PPT生成API

```typescript
// 生成PPT
POST /api/projects/{projectId}/ppt
Body: {
  templateId: string;
  options: {
    includePages: string[];      // 包含的页面类型
    houseTypes: string[];        // 展示的户型
    includePrice: boolean;
    agentInfo?: {
      name: string;
      phone: string;
      qrCode?: string;
    };
  };
}
Response: {
  taskId: string;
  status: 'processing';
}

// 查询生成状态
GET /api/ppt/tasks/{taskId}
Response: {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    pptxUrl: string;
    pdfUrl: string;
    previewImages: string[];
  };
}
```

### 8.4 技术实现

```typescript
// 使用 pptxgenjs 生成PPT
import PptxGenJS from 'pptxgenjs';

async function generatePPT(
  project: Project,
  template: PPTTemplate,
  options: PPTOptions
): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // 设置主题
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
  pptx.layout = 'LAYOUT_16x9';

  // 生成封面
  const coverSlide = pptx.addSlide();
  await renderCoverPage(coverSlide, project, template);

  // 生成内容页
  for (const pageType of options.includePages) {
    const slide = pptx.addSlide();
    await renderContentPage(slide, project, pageType, template);
  }

  // 生成户型页
  for (const houseTypeId of options.houseTypes) {
    const houseType = project.houseTypes.find(h => h.id === houseTypeId);
    if (houseType) {
      const slide = pptx.addSlide();
      await renderHouseTypePage(slide, houseType, template);
    }
  }

  // 生成联系页
  if (options.agentInfo) {
    const contactSlide = pptx.addSlide();
    await renderContactPage(contactSlide, options.agentInfo, template);
  }

  return await pptx.write({ outputType: 'nodebuffer' });
}
```

---

## 九、IP形象系统

### 9.1 IP数据结构

```typescript
interface AgentProfile {
  id: string;
  userId: string;

  // 基础信息
  name: string;
  nickname?: string;
  avatar: string;
  coverImage?: string;

  // 专业信息
  yearsOfExperience: number;
  specializedAreas: string[];      // 擅长区域
  specializedTypes: string[];      // 擅长户型
  totalDeals: number;              // 成交套数
  totalClients: number;            // 服务客户数

  // IP风格
  style: 'professional' | 'friendly' | 'expert' | 'energetic';
  slogan: string;
  introduction: string;

  // 统一元素
  signature: string;               // 签名档
  openingLine: string;             // 开场白
  closingLine: string;             // 结束语
  watermark: WatermarkConfig;

  // 联系方式
  phone: string;
  wechat?: string;
  qrCode?: string;

  createdAt: Date;
  updatedAt: Date;
}

interface WatermarkConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
  includeAvatar: boolean;
  includeName: boolean;
  includePhone: boolean;
}
```

### 9.2 内容风格统一

```typescript
// 自动添加签名
function applySignature(content: string, profile: AgentProfile): string {
  return `${content}\n\n${profile.signature}`;
}

// 生成带水印的图片
async function addWatermark(
  imageBuffer: Buffer,
  profile: AgentProfile
): Promise<Buffer> {
  const { watermark } = profile;
  if (!watermark.enabled) return imageBuffer;

  // 使用 sharp 添加水印
  const watermarkImage = await generateWatermarkImage(profile, watermark);
  return await sharp(imageBuffer)
    .composite([{
      input: watermarkImage,
      gravity: watermark.position.replace('-', '')
    }])
    .toBuffer();
}
```

### 9.3 成交海报生成

```typescript
interface PosterRequest {
  type: 'deal' | 'monthly' | 'testimonial';
  data: DealPosterData | MonthlyPosterData | TestimonialPosterData;
  templateId?: string;
}

interface DealPosterData {
  clientName: string;
  projectName: string;
  houseType: string;
  dealDate: Date;
  agentProfile: AgentProfile;
}

// 使用 canvas 生成海报
async function generatePoster(request: PosterRequest): Promise<Buffer> {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  // 加载模板背景
  const template = await loadTemplate(request.templateId);
  ctx.drawImage(template.background, 0, 0);

  // 渲染内容
  switch (request.type) {
    case 'deal':
      await renderDealPoster(ctx, request.data as DealPosterData);
      break;
    case 'monthly':
      await renderMonthlyPoster(ctx, request.data as MonthlyPosterData);
      break;
    case 'testimonial':
      await renderTestimonialPoster(ctx, request.data as TestimonialPosterData);
      break;
  }

  return canvas.toBuffer('image/png');
}
```

### 9.4 API接口

```typescript
// 获取经纪人IP信息
GET /api/agent-profile
Response: AgentProfile

// 更新经纪人IP信息
PUT /api/agent-profile
Body: Partial<AgentProfile>

// 生成海报
POST /api/posters
Body: PosterRequest
Response: { taskId: string; status: 'processing' }

// 获取海报生成结果
GET /api/posters/{taskId}
Response: { status: string; imageUrl?: string }

// 添加水印
POST /api/watermark
Body: { imageUrl: string }
Response: { imageUrl: string }
```

---

## 十、客户管理系统

### 10.1 数据结构

```typescript
interface Customer {
  id: string;
  agentId: string;              // 所属经纪人

  // 基本信息
  name: string;                 // 称呼
  phone?: string;
  wechat?: string;

  // 需求信息
  budget: { min: number; max: number };  // 预算范围（万）
  areas: string[];              // 意向区域
  houseType: string;            // 户型需求
  purpose: 'self' | 'invest' | 'education' | 'retirement';

  // 标签
  autoTags: string[];           // 系统自动标签
  manualTags: string[];         // 手动标签

  // 状态
  status: 'new' | 'contacted' | 'toured' | 'negotiating' | 'closed' | 'paused';
  lastContactAt: Date;
  nextFollowUpAt?: Date;

  // 记录
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FollowUpRecord {
  id: string;
  customerId: string;
  type: 'call' | 'wechat' | 'tour' | 'meeting' | 'other';
  content: string;
  result?: string;
  nextAction?: string;
  createdAt: Date;
}
```

### 10.2 智能标签引擎

```typescript
// 根据客户信息自动生成标签
function generateAutoTags(customer: Customer): string[] {
  const tags: string[] = [];

  // 预算标签
  if (customer.budget.max <= 200) tags.push('刚需');
  else if (customer.budget.max <= 500) tags.push('改善');
  else tags.push('高端');

  // 区域标签
  customer.areas.forEach(area => {
    tags.push(`${area}客`);
  });

  // 目的标签
  const purposeMap = {
    self: '自住', invest: '投资',
    education: '学区', retirement: '养老'
  };
  tags.push(purposeMap[customer.purpose]);

  return tags;
}
```

### 10.3 跟进提醒调度

```typescript
interface FollowUpRule {
  status: Customer['status'];
  idleDays: number;             // 未跟进天数阈值
  reminderTemplate: string;     // 提醒话术模板
  priority: 'high' | 'medium' | 'low';
}

const followUpRules: FollowUpRule[] = [
  { status: 'new', idleDays: 1, reminderTemplate: '{name}还没跟进，发条消息问问需求？', priority: 'high' },
  { status: 'contacted', idleDays: 3, reminderTemplate: '{name}{days}天没联系了，约个时间带看？', priority: 'medium' },
  { status: 'toured', idleDays: 2, reminderTemplate: '{name}看房后{days}天了，问问考虑得怎么样？', priority: 'high' },
  { status: 'negotiating', idleDays: 1, reminderTemplate: '{name}在考虑中，今天跟进一下？', priority: 'high' },
  { status: 'paused', idleDays: 7, reminderTemplate: '{name}搁置一周了，要不要激活？', priority: 'low' },
];

// 每日定时任务：扫描需要跟进的客户
async function scanFollowUps(agentId: string): Promise<FollowUpReminder[]> {
  const customers = await db.customers.findMany({
    where: { agentId, status: { not: 'closed' } }
  });

  const reminders: FollowUpReminder[] = [];
  const now = new Date();

  for (const customer of customers) {
    const rule = followUpRules.find(r => r.status === customer.status);
    if (!rule) continue;

    const idleDays = diffDays(now, customer.lastContactAt);
    if (idleDays >= rule.idleDays) {
      reminders.push({
        customerId: customer.id,
        customerName: customer.name,
        message: rule.reminderTemplate
          .replace('{name}', customer.name)
          .replace('{days}', String(idleDays)),
        priority: rule.priority,
      });
    }
  }

  return reminders.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}
```

### 10.4 API接口

```typescript
// 创建客户（支持自然语言录入）
POST /api/customers
Body: {
  mode: 'form' | 'natural_language';
  data?: Partial<Customer>;       // form模式
  text?: string;                  // 自然语言模式
}

// 客户列表
GET /api/customers?status=new&tag=刚需&page=1&limit=20

// 更新客户状态
PATCH /api/customers/{id}
Body: Partial<Customer>

// 添加跟进记录
POST /api/customers/{id}/follow-ups
Body: { type: string; content: string; nextAction?: string }

// 获取今日待跟进
GET /api/follow-up-reminders

// AI解析自然语言录入
POST /api/customers/parse
Body: { text: string }
Response: Partial<Customer>
```

---

## 十一、楼盘信息查询系统

### 11.1 查询架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户自然语言输入                          │
│         "XX花园89平的户型怎么样"                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      意图识别 (NLU)                           │
│  - 查询类型分类                                              │
│  - 实体提取（楼盘名、户型、面积等）                            │
│  - 参数标准化                                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      查询路由                                 │
│  基础信息 │ 户型查询 │ 价格查询 │ 配套查询 │ 对比查询          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据检索 + AI格式化                      │
│  - 从物料库检索结构化数据                                     │
│  - AI生成自然语言回答                                        │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 意图识别

```typescript
type QueryIntent =
  | 'basic_info'      // 基础信息（位置、开发商、交房时间）
  | 'house_type'      // 户型查询
  | 'price'           // 价格查询
  | 'facilities'      // 配套查询
  | 'comparison'      // 楼盘对比
  | 'unknown';

interface QueryParseResult {
  intent: QueryIntent;
  entities: {
    projectNames: string[];     // 楼盘名称
    houseType?: string;         // 户型
    area?: number;              // 面积
    facilityType?: string;      // 配套类型（学校/地铁/商场）
  };
  confidence: number;
}

const intentClassifyPrompt = `
你是一个房产查询意图分类器。根据用户输入，返回JSON：
{
  "intent": "basic_info|house_type|price|facilities|comparison",
  "entities": {
    "projectNames": ["楼盘名"],
    "houseType": "户型（可选）",
    "area": 面积数字（可选）,
    "facilityType": "配套类型（可选）"
  }
}

用户输入：{query}
`;
```

### 11.3 数据检索

```typescript
async function queryProjectInfo(
  parsed: QueryParseResult
): Promise<QueryResponse> {
  const project = await db.projects.findFirst({
    where: { name: { contains: parsed.entities.projectNames[0] } },
    include: { houseTypes: true, facilities: true, materials: true }
  });

  if (!project) {
    return { type: 'not_found', suggestion: '要帮你添加这个楼盘吗？' };
  }

  switch (parsed.intent) {
    case 'basic_info':
      return formatBasicInfo(project);
    case 'house_type':
      return formatHouseType(project, parsed.entities.area);
    case 'price':
      return formatPrice(project, parsed.entities.houseType);
    case 'facilities':
      return formatFacilities(project, parsed.entities.facilityType);
    case 'comparison':
      const project2 = await db.projects.findFirst({
        where: { name: { contains: parsed.entities.projectNames[1] } },
        include: { houseTypes: true, facilities: true }
      });
      return formatComparison(project, project2);
    default:
      return { type: 'clarify', suggestion: '你想了解哪方面信息？' };
  }
}
```

### 11.4 对比表格生成

```typescript
interface ComparisonTable {
  dimensions: string[];
  projects: {
    name: string;
    values: Record<string, string>;
  }[];
  summary: string;
}

function generateComparison(
  projectA: Project,
  projectB: Project
): ComparisonTable {
  const dimensions = [
    '位置', '开发商', '主力户型', '单价', '地铁', '学区', '交房时间'
  ];

  return {
    dimensions,
    projects: [
      { name: projectA.name, values: extractValues(projectA, dimensions) },
      { name: projectB.name, values: extractValues(projectB, dimensions) },
    ],
    summary: '' // 由AI生成总结建议
  };
}
```

### 11.5 API接口

```typescript
// 自然语言查询
POST /api/query
Body: { question: string; context?: string }
Response: {
  intent: QueryIntent;
  answer: string;
  data?: any;              // 结构化数据
  suggestions?: string[];  // 追问建议
}

// 楼盘对比
POST /api/projects/compare
Body: { projectIds: string[] }
Response: ComparisonTable
```

---

## 十二、智能匹配引擎

### 12.1 匹配架构

```
┌──────────────┐    ┌──────────────┐
│   客户需求    │    │   楼盘特征    │
│  结构化数据   │    │  结构化数据   │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  需求向量化   │    │  楼盘向量化   │
│  Embedding   │    │  Embedding   │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └────────┬──────────┘
                ▼
       ┌────────────────┐
       │   多维度匹配    │
       │  加权相似度计算  │
       └────────┬───────┘
                ▼
       ┌────────────────┐
       │   排序 + AI解释 │
       │  生成推荐理由   │
       └────────────────┘
```

### 12.2 向量化与索引

```typescript
// 使用向量数据库存储楼盘特征
import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient();
const projectCollection = await chroma.getOrCreateCollection({
  name: 'project_vectors',
  metadata: { 'hnsw:space': 'cosine' }
});

// 楼盘特征向量化
async function indexProject(project: Project): Promise<void> {
  const featureText = [
    `区域:${project.district}`,
    `单价:${project.unitPrice}万`,
    `面积:${project.houseTypes.map(h => h.area).join('/')}㎡`,
    `配套:${project.facilities.map(f => f.name).join(',')}`,
    `产品:${project.productType}`,
    `交房:${project.deliveryDate}`,
  ].join(' ');

  await projectCollection.upsert({
    ids: [project.id],
    documents: [featureText],
    metadatas: [{
      district: project.district,
      minPrice: project.minTotalPrice,
      maxPrice: project.maxTotalPrice,
      minArea: Math.min(...project.houseTypes.map(h => h.area)),
      maxArea: Math.max(...project.houseTypes.map(h => h.area)),
    }]
  });
}
```

### 12.3 多维度匹配算法

```typescript
interface MatchDimension {
  name: string;
  weight: number;
  scorer: (customer: Customer, project: Project) => number;
}

const matchDimensions: MatchDimension[] = [
  {
    name: '价格匹配',
    weight: 0.3,
    scorer: (c, p) => {
      const budgetCenter = (c.budget.min + c.budget.max) / 2;
      const priceCenter = (p.minTotalPrice + p.maxTotalPrice) / 2;
      const diff = Math.abs(budgetCenter - priceCenter) / budgetCenter;
      return Math.max(0, 1 - diff);
    }
  },
  {
    name: '区域匹配',
    weight: 0.25,
    scorer: (c, p) => c.areas.includes(p.district) ? 1.0 : 0.0
  },
  {
    name: '面积匹配',
    weight: 0.2,
    scorer: (c, p) => {
      const hasMatch = p.houseTypes.some(h =>
        h.rooms === parseInt(c.houseType) ||
        (h.area >= c.budget.min * 0.8 && h.area <= c.budget.max * 1.2)
      );
      return hasMatch ? 1.0 : 0.3;
    }
  },
  {
    name: '配套匹配',
    weight: 0.15,
    scorer: (c, p) => {
      const needs = extractFacilityNeeds(c);
      const has = p.facilities.map(f => f.type);
      const matched = needs.filter(n => has.includes(n)).length;
      return needs.length > 0 ? matched / needs.length : 0.5;
    }
  },
  {
    name: '产品匹配',
    weight: 0.1,
    scorer: (c, p) => {
      const pref = extractProductPreference(c);
      return pref === p.productType ? 1.0 : 0.5;
    }
  }
];

async function matchProjects(
  customer: Customer,
  limit: number = 5
): Promise<MatchResult[]> {
  // 第一步：向量粗筛（召回Top 20）
  const candidates = await projectCollection.query({
    queryTexts: [buildCustomerQuery(customer)],
    nResults: 20,
    where: {
      minPrice: { $lte: customer.budget.max * 10000 },
      maxPrice: { $gte: customer.budget.min * 10000 },
    }
  });

  // 第二步：多维度精排
  const projects = await db.projects.findMany({
    where: { id: { in: candidates.ids[0] } },
    include: { houseTypes: true, facilities: true }
  });

  const scored = projects.map(project => {
    const scores = matchDimensions.map(dim => ({
      dimension: dim.name,
      score: dim.scorer(customer, project),
      weight: dim.weight,
    }));
    const totalScore = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
    return { project, scores, totalScore };
  });

  // 第三步：排序取Top N
  scored.sort((a, b) => b.totalScore - a.totalScore);
  const topResults = scored.slice(0, limit);

  // 第四步：AI生成推荐理由
  for (const result of topResults) {
    result.reason = await generateMatchReason(customer, result);
  }

  return topResults;
}
```

### 12.4 推荐理由生成

```typescript
const matchReasonPrompt = `
根据客户需求和楼盘信息，生成简洁的推荐理由。

客户需求：{customer_needs}
楼盘信息：{project_info}
匹配评分：{scores}

要求：
1. 2-3句话说明推荐原因
2. 突出最匹配的维度
3. 提及需要注意的点
4. 推荐最适合的户型
`;

interface MatchResult {
  project: Project;
  totalScore: number;
  scores: { dimension: string; score: number }[];
  reason?: string;
  recommendedHouseType?: string;
}
```

### 12.5 API接口

```typescript
// 为客户匹配楼盘
POST /api/customers/{customerId}/match
Body: { limit?: number; filters?: Record<string, any> }
Response: {
  matches: MatchResult[];
  totalCandidates: number;
}

// 获取楼盘推荐（带缓存）
GET /api/recommendations/{customerId}?refresh=false
Response: {
  matches: MatchResult[];
  generatedAt: string;
  expiresAt: string;
}
```

---

## 十三、费用计算器

### 13.1 计算引擎

```typescript
// 等额本息月供计算
function calcEqualInstallment(
  principal: number,    // 贷款金额（元）
  annualRate: number,   // 年利率（如4.2表示4.2%）
  years: number         // 贷款年限
): MortgageResult {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const monthlyPayment = principal * monthlyRate *
    Math.pow(1 + monthlyRate, months) /
    (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;

  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalInterest),
    method: 'equal_installment'
  };
}

// 等额本金月供计算
function calcEqualPrincipal(
  principal: number,
  annualRate: number,
  years: number
): MortgageResult {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const monthlyPrincipal = principal / months;
  const firstMonthPayment = monthlyPrincipal + principal * monthlyRate;
  const lastMonthPayment = monthlyPrincipal + monthlyPrincipal * monthlyRate;
  const totalInterest = (months + 1) * principal * monthlyRate / 2;

  return {
    monthlyPayment: Math.round(firstMonthPayment),  // 首月
    lastMonthPayment: Math.round(lastMonthPayment),  // 末月
    totalPayment: Math.round(principal + totalInterest),
    totalInterest: Math.round(totalInterest),
    method: 'equal_principal'
  };
}

interface MortgageResult {
  monthlyPayment: number;
  lastMonthPayment?: number;
  totalPayment: number;
  totalInterest: number;
  method: 'equal_installment' | 'equal_principal';
}
```

### 13.2 税费计算

```typescript
interface TaxCalcInput {
  totalPrice: number;       // 房屋总价（万）
  area: number;             // 面积（㎡）
  isFirstHome: boolean;     // 是否首套
  isOver5Years: boolean;    // 是否满五年（二手房）
  isUnique: boolean;        // 是否唯一（二手房）
  isNewHome: boolean;       // 新房/二手房
}

interface TaxResult {
  deedTax: number;          // 契税
  vatTax: number;           // 增值税
  incomeTax: number;        // 个人所得税
  agencyFee: number;        // 中介费
  otherFees: number;        // 其他费用
  totalFees: number;        // 总费用
  breakdown: { name: string; amount: number; rate: string }[];
}

function calcTax(input: TaxCalcInput): TaxResult {
  const { totalPrice, area, isFirstHome, isOver5Years, isUnique, isNewHome } = input;
  const priceYuan = totalPrice * 10000;

  // 契税
  let deedTaxRate: number;
  if (isFirstHome && area <= 90) deedTaxRate = 0.01;
  else if (isFirstHome && area > 90) deedTaxRate = 0.015;
  else deedTaxRate = 0.03;
  const deedTax = priceYuan * deedTaxRate;

  // 增值税（二手房，满2年免征）
  const vatTax = (!isNewHome && !isOver5Years)
    ? priceYuan * 0.053 : 0;

  // 个人所得税（满五唯一免征）
  const incomeTax = (!isNewHome && !(isOver5Years && isUnique))
    ? priceYuan * 0.01 : 0;

  // 中介费（二手房）
  const agencyFee = isNewHome ? 0 : priceYuan * 0.02;

  // 其他费用（权证、评估等）
  const otherFees = 5000;

  const totalFees = deedTax + vatTax + incomeTax + agencyFee + otherFees;

  return {
    deedTax, vatTax, incomeTax, agencyFee, otherFees, totalFees,
    breakdown: [
      { name: '契税', amount: deedTax, rate: `${deedTaxRate * 100}%` },
      { name: '增值税', amount: vatTax, rate: vatTax > 0 ? '5.3%' : '免征' },
      { name: '个税', amount: incomeTax, rate: incomeTax > 0 ? '1%' : '免征' },
      { name: '中介费', amount: agencyFee, rate: agencyFee > 0 ? '2%' : '无' },
      { name: '其他', amount: otherFees, rate: '固定' },
    ]
  };
}
```

### 13.3 首付计算

```typescript
interface DownPaymentInput {
  totalPrice: number;           // 房屋总价（万）
  isFirstHome: boolean;         // 是否首套
  providentFundBalance?: number; // 公积金余额（万）
  loanYears?: number;           // 贷款年限
}

function calcDownPayment(input: DownPaymentInput): DownPaymentResult {
  const ratio = input.isFirstHome ? 0.3 : 0.5;
  const downPayment = input.totalPrice * ratio;
  const loanAmount = input.totalPrice - downPayment;
  const years = input.loanYears || 30;

  const mortgage = calcEqualInstallment(
    loanAmount * 10000,
    getCurrentLPR(),
    years
  );

  return {
    downPaymentRatio: ratio,
    downPayment,
    loanAmount,
    monthlyPayment: mortgage.monthlyPayment,
    providentFundDeduction: input.providentFundBalance || 0,
    actualDownPayment: downPayment - (input.providentFundBalance || 0),
  };
}

// LPR利率管理
interface LPRConfig {
  rate5YearAbove: number;   // 5年期以上LPR
  rate5YearBelow: number;   // 5年期以下LPR
  updatedAt: Date;
}

function getCurrentLPR(): number {
  // 从配置中获取最新LPR利率
  return config.get<number>('lpr.rate5YearAbove', 3.95);
}
```

### 13.4 自然语言触发

```typescript
// 从对话中识别计算意图
const calcIntentPrompt = `
判断用户是否想进行费用计算，返回JSON：
{
  "isCalcRequest": true/false,
  "calcType": "mortgage|tax|downpayment",
  "params": {
    "totalPrice": 数字（万）,
    "loanAmount": 数字（万）,
    "years": 数字,
    "area": 数字（㎡）,
    "isFirstHome": true/false
  }
}

用户输入：{query}
`;
```

### 13.5 API接口

```typescript
// 月供计算
POST /api/calculator/mortgage
Body: {
  loanAmount: number;       // 贷款金额（万）
  years: number;            // 贷款年限
  rate?: number;            // 利率（默认LPR）
  method: 'equal_installment' | 'equal_principal';
}
Response: MortgageResult

// 税费计算
POST /api/calculator/tax
Body: TaxCalcInput
Response: TaxResult

// 首付计算
POST /api/calculator/downpayment
Body: DownPaymentInput
Response: DownPaymentResult

// 获取当前LPR利率
GET /api/calculator/lpr
Response: LPRConfig
```

---

## 十四、多渠道消息中心

### 14.1 消息聚合架构

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  微信     │ │ 企业微信  │ │  抖音    │ │ 小红书    │
│ Webhook  │ │ Webhook  │ │  API     │ │  API     │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     └────────────┴─────┬──────┴────────────┘
                        ▼
              ┌──────────────────┐
              │   消息网关        │
              │  统一格式转换     │
              │  消息去重/排序    │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │   消息队列        │
              │  Redis Stream    │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │   消息处理器      │
              │  存储/通知/AI分析 │
              └──────────────────┘
```

### 14.2 统一消息模型

```typescript
interface UnifiedMessage {
  id: string;
  agentId: string;              // 经纪人ID
  channel: 'wechat' | 'wecom' | 'douyin' | 'xiaohongshu' | 'sms';
  direction: 'inbound' | 'outbound';

  // 发送方
  sender: {
    id: string;                 // 渠道内用户ID
    name: string;
    avatar?: string;
  };

  // 消息内容
  content: {
    type: 'text' | 'image' | 'voice' | 'video' | 'link' | 'location';
    text?: string;
    mediaUrl?: string;
    metadata?: Record<string, any>;
  };

  // 关联
  customerId?: string;          // 关联客户ID
  conversationId: string;       // 会话ID
  replyToId?: string;           // 回复的消息ID

  // 状态
  status: 'received' | 'read' | 'replied' | 'archived';
  isImportant: boolean;
  createdAt: Date;
}

interface Conversation {
  id: string;
  agentId: string;
  channel: string;
  customerId?: string;
  lastMessageAt: Date;
  unreadCount: number;
  messages: UnifiedMessage[];
}
```

### 14.3 渠道适配器

```typescript
interface ChannelAdapter {
  channel: string;
  parseInbound(rawData: any): UnifiedMessage;
  formatOutbound(message: UnifiedMessage): any;
  sendMessage(to: string, content: any): Promise<boolean>;
  verifyWebhook(req: Request): boolean;
}

// 微信适配器
class WechatAdapter implements ChannelAdapter {
  channel = 'wechat';

  parseInbound(rawData: WechatMessage): UnifiedMessage {
    return {
      id: generateId(),
      channel: 'wechat',
      direction: 'inbound',
      sender: {
        id: rawData.FromUserName,
        name: rawData.FromUserName,
      },
      content: {
        type: mapWechatMsgType(rawData.MsgType),
        text: rawData.Content,
        mediaUrl: rawData.MediaId ? resolveMediaUrl(rawData.MediaId) : undefined,
      },
      conversationId: `wechat_${rawData.FromUserName}`,
      status: 'received',
      isImportant: false,
      createdAt: new Date(rawData.CreateTime * 1000),
    } as UnifiedMessage;
  }

  async sendMessage(to: string, content: any): Promise<boolean> {
    return await wechatApi.sendCustomMessage(to, content);
  }
}

// 适配器注册
const adapters: Record<string, ChannelAdapter> = {
  wechat: new WechatAdapter(),
  wecom: new WecomAdapter(),
  douyin: new DouyinAdapter(),
  xiaohongshu: new XiaohongshuAdapter(),
};
```

### 14.4 智能回复

```typescript
interface SmartReplyRequest {
  conversationId: string;
  inboundMessage: UnifiedMessage;
  customerProfile?: Customer;
}

async function generateSmartReply(
  req: SmartReplyRequest
): Promise<string[]> {
  // 获取会话历史
  const history = await db.messages.findMany({
    where: { conversationId: req.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const prompt = `
你是房产经纪人的AI助手。根据客户消息和会话历史，生成3条候选回复。

客户消息：${req.inboundMessage.content.text}
会话历史：${formatHistory(history)}
${req.customerProfile ? `客户信息：${JSON.stringify(req.customerProfile)}` : ''}

要求：
1. 回复专业、亲切
2. 第一条最推荐，后两条为备选
3. 每条不超过100字
返回JSON数组：["回复1", "回复2", "回复3"]
`;

  const response = await aiService.generate(prompt);
  return JSON.parse(response);
}
```

### 14.5 快捷回复模板

```typescript
interface QuickReply {
  id: string;
  agentId: string;
  category: string;           // 分类：问候/报价/约看/跟进
  title: string;              // 模板标题
  content: string;            // 模板内容（支持变量）
  variables?: string[];       // 可替换变量
  usageCount: number;
}

// 变量替换
function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}
```

### 14.6 API接口

```typescript
// Webhook接收（各渠道）
POST /api/webhooks/{channel}

// 获取会话列表
GET /api/conversations?channel=wechat&status=unread&page=1
Response: { conversations: Conversation[]; total: number }

// 获取会话消息
GET /api/conversations/{id}/messages?limit=20&before={messageId}
Response: { messages: UnifiedMessage[] }

// 发送消息
POST /api/conversations/{id}/messages
Body: { content: { type: string; text?: string; mediaUrl?: string } }

// 获取智能回复建议
POST /api/conversations/{id}/smart-reply
Response: { suggestions: string[] }

// 快捷回复模板
GET /api/quick-replies?category=greeting
POST /api/quick-replies
Body: QuickReply
```

---

## 十五、AI带看助手

### 15.1 带看流程架构

```
┌─────────────────────────────────────────────────────────────┐
│                       带看前                                 │
│  创建带看计划 → 生成准备清单 → 定制话术 → 规划路线            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       带看中                                 │
│  实时查询 → 竞品对比 → 费用计算 → 异议应对                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       带看后                                 │
│  生成总结 → 意向评估 → 跟进建议 → 更新客户档案               │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 数据结构

```typescript
interface TourPlan {
  id: string;
  agentId: string;
  customerId: string;
  scheduledAt: Date;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';

  // 带看楼盘
  projects: {
    projectId: string;
    order: number;              // 参观顺序
    houseTypeIds: string[];     // 要看的户型
    estimatedDuration: number;  // 预计时长（分钟）
  }[];

  // AI生成内容
  preparation?: TourPreparation;
  summary?: TourSummary;

  createdAt: Date;
  updatedAt: Date;
}

interface TourPreparation {
  customerBrief: string;        // 客户简况
  focusPoints: string[];        // 客户关注点预测
  customScripts: {              // 针对性话术
    projectId: string;
    script: string;
    objections: { question: string; answer: string }[];
  }[];
  routeSuggestion: string;      // 路线建议
  timeAllocation: { projectName: string; minutes: number }[];
}

interface TourSummary {
  duration: number;             // 实际时长（分钟）
  projectsFeedback: {
    projectId: string;
    projectName: string;
    interest: 'high' | 'medium' | 'low';
    feedback: string;           // 客户反馈
    concerns: string[];         // 客户顾虑
  }[];
  overallAssessment: string;    // 整体评估
  nextSteps: string[];          // 下一步建议
  followUpDate: Date;           // 建议跟进日期
  followUpScript: string;       // 跟进话术
}
```

### 15.3 带看前准备生成

```typescript
async function generatePreparation(
  plan: TourPlan
): Promise<TourPreparation> {
  const customer = await db.customers.findUnique({
    where: { id: plan.customerId }
  });
  const projects = await db.projects.findMany({
    where: { id: { in: plan.projects.map(p => p.projectId) } },
    include: { houseTypes: true, facilities: true }
  });

  const prompt = `
你是资深房产经纪人助手。根据客户信息和待看楼盘，生成带看准备材料。

## 客户信息
${JSON.stringify(customer)}

## 待看楼盘
${projects.map(p => JSON.stringify(p)).join('\n')}

## 请生成
1. 客户简况（50字内）
2. 客户可能关注的3-5个重点
3. 每个楼盘的针对性话术（突出与客户需求匹配的卖点）
4. 每个楼盘可能遇到的异议及应对
5. 参观路线建议和时间分配

返回JSON格式。
`;

  const result = await aiService.generate(prompt);
  return JSON.parse(result);
}
```

### 15.4 带看中实时查询

```typescript
interface TourQuery {
  tourId: string;
  question: string;
  context?: {
    currentProjectId?: string;
    currentHouseTypeId?: string;
  };
}

async function handleTourQuery(query: TourQuery): Promise<string> {
  const tour = await db.tourPlans.findUnique({
    where: { id: query.tourId },
    include: { customer: true }
  });

  // 识别查询类型并路由
  const intent = await classifyTourQueryIntent(query.question);

  switch (intent) {
    case 'property_info':
      return await queryProjectInfo(parseQuery(query.question));
    case 'comparison':
      return await generateComparison(query.context);
    case 'calculation':
      return await handleCalculation(query.question);
    case 'objection':
      return await generateObjectionResponse(
        query.question, query.context?.currentProjectId
      );
    default:
      return await aiService.generate(
        `回答经纪人在带看过程中的问题：${query.question}`
      );
  }
}
```

### 15.5 带看后总结生成

```typescript
async function generateTourSummary(
  tourId: string,
  feedbackInput: {
    projectId: string;
    interest: 'high' | 'medium' | 'low';
    notes: string;
  }[]
): Promise<TourSummary> {
  const tour = await db.tourPlans.findUnique({
    where: { id: tourId },
    include: { customer: true }
  });

  const prompt = `
根据带看情况生成总结报告和跟进建议。

客户：${tour.customer.name}
看房反馈：
${feedbackInput.map(f => `- ${f.projectId}: 意向${f.interest}, ${f.notes}`).join('\n')}

请生成：
1. 每个楼盘的客户反馈总结和顾虑点
2. 整体意向评估
3. 具体的下一步行动建议（3-5条）
4. 建议跟进日期
5. 跟进话术（100字内）

返回JSON格式。
`;

  const summary = JSON.parse(await aiService.generate(prompt));

  // 自动更新客户状态
  await db.customers.update({
    where: { id: tour.customerId },
    data: {
      status: 'toured',
      lastContactAt: new Date(),
      nextFollowUpAt: summary.followUpDate,
    }
  });

  return summary;
}
```

### 15.6 API接口

```typescript
// 创建带看计划
POST /api/tours
Body: {
  customerId: string;
  scheduledAt: string;
  projects: { projectId: string; houseTypeIds: string[] }[];
}
Response: TourPlan

// 生成带看准备
POST /api/tours/{tourId}/prepare
Response: TourPreparation

// 带看中实时查询
POST /api/tours/{tourId}/query
Body: { question: string; context?: any }
Response: { answer: string }

// 提交带看反馈并生成总结
POST /api/tours/{tourId}/summary
Body: {
  feedback: { projectId: string; interest: string; notes: string }[];
}
Response: TourSummary

// 获取带看历史
GET /api/tours?customerId={id}&status=completed&page=1
Response: { tours: TourPlan[]; total: number }
```

---

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

### 17.1 错误分类

```typescript
enum ErrorCode {
  // 客户端错误 4xx
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // AI服务错误 5xx
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_CONTENT_FILTERED = 'AI_CONTENT_FILTERED',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',

  // 外部服务错误
  SMS_SEND_FAILED = 'SMS_SEND_FAILED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  CHANNEL_API_ERROR = 'CHANNEL_API_ERROR',

  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

interface ApiError {
  code: ErrorCode;
  message: string;              // 用户可见的错误信息
  detail?: string;              // 开发调试信息（仅开发环境）
  requestId: string;            // 请求追踪ID
}
```

### 17.2 AI服务降级策略

```typescript
interface FallbackChain {
  primary: string;              // 主模型
  fallbacks: string[];          // 降级模型列表
  maxRetries: number;
  retryDelay: number;           // 毫秒
}

const aiServiceFallback: FallbackChain = {
  primary: 'claude-sonnet-4-20250514',
  fallbacks: ['gpt-4o', 'deepseek-chat'],
  maxRetries: 2,
  retryDelay: 1000,
};

async function callWithFallback<T>(
  fn: (model: string) => Promise<T>,
  chain: FallbackChain
): Promise<T> {
  const models = [chain.primary, ...chain.fallbacks];

  for (let i = 0; i < models.length; i++) {
    for (let retry = 0; retry <= chain.maxRetries; retry++) {
      try {
        return await fn(models[i]);
      } catch (error) {
        const isLastModel = i === models.length - 1;
        const isLastRetry = retry === chain.maxRetries;

        if (isLastModel && isLastRetry) throw error;
        if (isLastRetry) break; // 切换下一个模型

        await sleep(chain.retryDelay * (retry + 1));
      }
    }
  }
  throw new Error('AI_SERVICE_UNAVAILABLE');
}
```

### 17.3 全局错误处理中间件

```typescript
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || generateId();

  // 记录错误日志
  logger.error({
    requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    userId: req.user?.userId,
  });

  // 已知业务错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      requestId,
    });
  }

  // 未知错误
  res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: '服务暂时不可用，请稍后重试',
    requestId,
  });
}

---

## 十八、限流与缓存策略

### 18.1 API限流

```typescript
interface RateLimitConfig {
  windowMs: number;             // 时间窗口（毫秒）
  maxRequests: number;          // 最大请求数
  keyGenerator: (req: Request) => string;
}

const rateLimits: Record<string, RateLimitConfig> = {
  // 通用API限流
  general: {
    windowMs: 60 * 1000,        // 1分钟
    maxRequests: 60,
    keyGenerator: (req) => req.user?.userId || req.ip,
  },
  // 内容生成限流（消耗AI资源）
  contentGeneration: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => req.user?.userId,
  },
  // 验证码限流
  smsCode: {
    windowMs: 60 * 1000,
    maxRequests: 1,
    keyGenerator: (req) => req.body.phone,
  },
};

// 基于Redis的滑动窗口限流
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // 移除过期记录，添加当前请求，统计窗口内请求数
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}`);
  pipeline.zcard(key);
  pipeline.expire(key, Math.ceil(config.windowMs / 1000));

  const results = await pipeline.exec();
  const count = results[2][1] as number;

  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt: now + config.windowMs,
  };
}
```

### 18.2 AI配额管理

```typescript
interface QuotaPlan {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  daily: {
    contentGeneration: number;  // 内容生成次数
    queryCount: number;         // 查询次数
    matchCount: number;         // 匹配次数
  };
  monthly: {
    totalTokens: number;        // 总Token数
    pptGeneration: number;      // PPT生成次数
    posterGeneration: number;   // 海报生成次数
  };
}

const quotaPlans: Record<string, QuotaPlan> = {
  free:       { plan: 'free',       daily: { contentGeneration: 5,   queryCount: 20,  matchCount: 5  }, monthly: { totalTokens: 100000,    pptGeneration: 2,   posterGeneration: 5  } },
  basic:      { plan: 'basic',      daily: { contentGeneration: 30,  queryCount: 100, matchCount: 20 }, monthly: { totalTokens: 1000000,   pptGeneration: 20,  posterGeneration: 50 } },
  pro:        { plan: 'pro',        daily: { contentGeneration: 100, queryCount: 500, matchCount: 50 }, monthly: { totalTokens: 5000000,   pptGeneration: 100, posterGeneration: 200 } },
  enterprise: { plan: 'enterprise', daily: { contentGeneration: -1,  queryCount: -1,  matchCount: -1 }, monthly: { totalTokens: -1,        pptGeneration: -1,  posterGeneration: -1 } },
};

// 配额检查
async function checkQuota(
  userId: string,
  action: string
): Promise<boolean> {
  const user = await db.users.findUnique({ where: { id: userId } });
  const plan = quotaPlans[user.plan];
  const usage = await getUsage(userId, action);

  const limit = plan.daily[action] ?? plan.monthly[action];
  if (limit === -1) return true; // 无限制
  return usage < limit;
}
```

### 18.3 缓存策略

```typescript
interface CacheConfig {
  key: string;
  ttl: number;                  // 秒
  staleWhileRevalidate?: number; // 过期后仍可使用的时间
}

const cacheConfigs: Record<string, CacheConfig> = {
  // 楼盘基础信息（变化少，长缓存）
  projectInfo:      { key: 'project:{id}',           ttl: 3600,  staleWhileRevalidate: 600 },
  // 户型信息
  houseTypes:       { key: 'project:{id}:types',     ttl: 3600 },
  // 楼盘匹配结果（个性化，短缓存）
  matchResults:     { key: 'match:{customerId}',     ttl: 300 },
  // LPR利率（每月更新）
  lprRate:          { key: 'lpr:current',             ttl: 86400 },
  // 用户配额使用量
  dailyUsage:       { key: 'usage:{userId}:{date}',  ttl: 86400 },
  // 快捷回复模板
  quickReplies:     { key: 'replies:{agentId}',      ttl: 1800 },
};

// 缓存读取（支持stale-while-revalidate）
async function cacheGet<T>(
  config: CacheConfig,
  params: Record<string, string>,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = interpolateKey(config.key, params);
  const cached = await redis.get(key);

  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  await redis.setex(key, config.ttl, JSON.stringify(data));
  return data;
}

// 缓存失效
async function cacheInvalidate(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

---

## 十九、完整数据库Schema

PRD中已定义 projects、house_types、materials、customers、generated_contents 五张表。以下补充缺失的表定义。

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
```
