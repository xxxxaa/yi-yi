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
