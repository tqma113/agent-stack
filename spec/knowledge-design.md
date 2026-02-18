# @ai-stack/knowledge 包设计文档

## 1. 设计目标

在现有 Memory 系统基础上扩展，提供**代码库索引**和**外部文档索引**能力，支持 Hybrid Search。

### 核心原则

- **复用而非重建** - 复用 `SemanticStore`、`EmbeddingCache`、`Ranking Pipeline`
- **统一检索** - Agent 可同时搜索会话记忆 + 代码 + 文档
- **增量索引** - 只对变更内容重新计算 embedding
- **渐进增强** - 不影响现有 Memory 功能

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Tools (内置能力)                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │ memorySearch│  │ codeSearch  │  │ docSearch                       │ │  │
│  │  │ (现有)      │  │ (新增)       │  │ (新增)                          │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────────┬─────────────────┘ │  │
│  └─────────┼────────────────┼─────────────────────────┼───────────────────┘  │
│            │                │                         │                      │
│            │                └────────────┬────────────┘                      │
│            │                             │                                   │
│            ▼                             ▼                                   │
│  ┌──────────────────┐         ┌──────────────────────────────────────────┐  │
│  │  @ai-stack/      │         │  @ai-stack/knowledge (新增)              │  │
│  │  memory          │         │  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  (现有)          │         │  │ CodeIndexer  │  │ DocIndexer       │  │  │
│  │                  │         │  │              │  │                  │  │  │
│  └────────┬─────────┘         │  └──────┬───────┘  └────────┬─────────┘  │  │
│           │                   │         │                   │            │  │
│           │                   │         └─────────┬─────────┘            │  │
│           │                   │                   │                      │  │
│           │                   │         ┌─────────▼─────────┐            │  │
│           │                   │         │ KnowledgeManager  │            │  │
│           │                   │         │ (统一协调)         │            │  │
│           │                   │         └─────────┬─────────┘            │  │
│           │                   └───────────────────┼──────────────────────┘  │
│           │                                       │                         │
│           └───────────────────┬───────────────────┘                         │
│                               │                                             │
│                     ┌─────────▼─────────┐                                   │
│                     │  SemanticStore    │ ← 统一存储 (复用)                  │
│                     │  (SQLite + Vec)   │                                   │
│                     └─────────┬─────────┘                                   │
│                               │                                             │
│                     ┌─────────▼─────────┐                                   │
│                     │ EmbeddingCache    │ ← 复用缓存                         │
│                     └─────────┬─────────┘                                   │
│                               │                                             │
│                     ┌─────────▼─────────┐                                   │
│                     │ Ranking Pipeline  │ ← 复用排序                         │
│                     │ (Decay + MMR)     │                                   │
│                     └───────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 包结构

```
packages/libs/knowledge/
├── src/
│   ├── index.ts                    # 包入口
│   ├── types.ts                    # 类型定义
│   ├── errors.ts                   # 错误类
│   │
│   ├── code/                       # 代码索引模块
│   │   ├── index.ts                # 模块导出
│   │   ├── indexer.ts              # createCodeIndexer()
│   │   ├── chunker.ts              # 代码切分策略
│   │   ├── watcher.ts              # 文件监听 + 增量更新
│   │   └── languages/              # 语言特定解析器
│   │       ├── index.ts            # 解析器注册表
│   │       ├── typescript.ts       # TypeScript/JavaScript 解析
│   │       ├── python.ts           # Python 解析
│   │       └── generic.ts          # 通用文本解析
│   │
│   ├── doc/                        # 文档索引模块
│   │   ├── index.ts                # 模块导出
│   │   ├── indexer.ts              # createDocIndexer()
│   │   ├── crawler.ts              # URL 爬取
│   │   ├── parser.ts               # HTML/Markdown 解析
│   │   └── registry.ts             # 文档源管理
│   │
│   ├── retriever/                  # 统一检索
│   │   ├── index.ts                # 模块导出
│   │   ├── hybrid-search.ts        # 混合搜索实现
│   │   └── reranker.ts             # 结果重排序
│   │
│   └── manager.ts                  # createKnowledgeManager()
│
├── tests/
│   ├── code/
│   │   ├── indexer.test.ts
│   │   ├── chunker.test.ts
│   │   └── watcher.test.ts
│   ├── doc/
│   │   ├── crawler.test.ts
│   │   └── parser.test.ts
│   └── retriever/
│       └── hybrid-search.test.ts
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## 4. 核心类型定义

### 4.1 通用类型

```typescript
// types.ts

import type { SemanticChunk, SemanticSearchResult } from '@ai-stack/memory-store-sqlite';

/**
 * 知识源类型
 */
export type KnowledgeSourceType =
  | 'code'        // 代码文件
  | 'doc'         // 外部文档
  | 'memory';     // 会话记忆 (复用现有)

/**
 * 知识块 (扩展 SemanticChunk)
 */
export interface KnowledgeChunk extends SemanticChunk {
  /** 来源类型 */
  sourceType: KnowledgeSourceType;

  /** 来源标识 (文件路径 / URL / sessionId) */
  sourceUri: string;

  /** 内容类型 (代码: 语言; 文档: mime-type) */
  contentType?: string;

  /** 代码相关元数据 */
  code?: {
    language: string;
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string;      // 函数名/类名
    symbolType?: string;      // 'function' | 'class' | 'interface' | etc.
    parentSymbol?: string;    // 父级符号
  };

  /** 文档相关元数据 */
  doc?: {
    url: string;
    title?: string;
    section?: string;
    fetchedAt: number;
    expiresAt?: number;
  };
}

/**
 * 知识搜索结果
 */
export interface KnowledgeSearchResult extends SemanticSearchResult {
  chunk: KnowledgeChunk;
  /** 来源类型 */
  sourceType: KnowledgeSourceType;
  /** 代码片段高亮 */
  highlight?: string;
}

/**
 * 搜索选项
 */
export interface KnowledgeSearchOptions {
  /** 搜索的来源类型 (默认全部) */
  sources?: KnowledgeSourceType[];
  /** 代码语言过滤 */
  languages?: string[];
  /** 文件路径 glob 模式 */
  filePatterns?: string[];
  /** 文档 URL 前缀过滤 */
  urlPrefixes?: string[];
  /** 结果数量限制 */
  limit?: number;
  /** 最小相关度分数 */
  minScore?: number;
  /** 是否使用向量搜索 */
  useVector?: boolean;
  /** 混合搜索权重 */
  weights?: { fts: number; vector: number };
}
```

### 4.2 代码索引类型

```typescript
// code/types.ts

/**
 * 代码块类型
 */
export type CodeSymbolType =
  | 'file'        // 整个文件
  | 'module'      // 模块/命名空间
  | 'class'       // 类
  | 'interface'   // 接口
  | 'function'    // 函数/方法
  | 'variable'    // 变量/常量
  | 'type'        // 类型别名
  | 'enum'        // 枚举
  | 'comment'     // 注释块
  | 'import'      // 导入语句
  | 'export';     // 导出语句

/**
 * 代码块
 */
export interface CodeBlock {
  /** 块 ID */
  id: string;
  /** 文件路径 */
  filePath: string;
  /** 语言 */
  language: string;
  /** 符号名称 */
  symbolName?: string;
  /** 符号类型 */
  symbolType: CodeSymbolType;
  /** 父符号 */
  parentSymbol?: string;
  /** 起始行 (1-based) */
  startLine: number;
  /** 结束行 (1-based) */
  endLine: number;
  /** 代码内容 */
  content: string;
  /** 文档注释 */
  docComment?: string;
  /** 签名 (函数签名/类型签名) */
  signature?: string;
  /** 依赖 (imports) */
  dependencies?: string[];
  /** 引用 (被哪些地方引用) */
  references?: string[];
}

/**
 * 索引状态
 */
export interface IndexStatus {
  /** 文件路径 */
  filePath: string;
  /** 文件内容 hash */
  contentHash: string;
  /** 最后索引时间 */
  indexedAt: number;
  /** 块数量 */
  chunkCount: number;
  /** 索引状态 */
  status: 'indexed' | 'pending' | 'error';
  /** 错误信息 */
  error?: string;
}

/**
 * 代码索引器配置
 */
export interface CodeIndexerConfig {
  /** 根目录 */
  rootDir: string;
  /** 包含的 glob 模式 */
  include?: string[];
  /** 排除的 glob 模式 */
  exclude?: string[];
  /** 最大文件大小 (bytes) */
  maxFileSize?: number;
  /** 块大小 (tokens) */
  chunkTokens?: number;
  /** 块重叠 (tokens) */
  overlapTokens?: number;
  /** 是否启用文件监听 */
  watch?: boolean;
  /** 监听防抖延迟 (ms) */
  watchDebounceMs?: number;
  /** 并发数 */
  concurrency?: number;
}

/**
 * 默认配置
 */
export const DEFAULT_CODE_INDEXER_CONFIG: CodeIndexerConfig = {
  rootDir: '.',
  include: ['**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,md,json}'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.map',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  chunkTokens: 400,
  overlapTokens: 80,
  watch: false,
  watchDebounceMs: 1000,
  concurrency: 4,
};
```

### 4.3 文档索引类型

```typescript
// doc/types.ts

/**
 * 文档源类型
 */
export type DocSourceType =
  | 'url'         // 单个 URL
  | 'sitemap'     // Sitemap
  | 'github'      // GitHub 仓库文档
  | 'notion'      // Notion 页面
  | 'local';      // 本地文件

/**
 * 文档源配置
 */
export interface DocSource {
  /** 源 ID */
  id: string;
  /** 名称 */
  name: string;
  /** 类型 */
  type: DocSourceType;
  /** URL / 路径 */
  url: string;
  /** 自定义标签 */
  tags?: string[];
  /** 抓取选项 */
  crawlOptions?: CrawlOptions;
  /** 是否启用 */
  enabled: boolean;
  /** 上次抓取时间 */
  lastCrawledAt?: number;
  /** 刷新间隔 (ms) */
  refreshInterval?: number;
}

/**
 * 抓取选项
 */
export interface CrawlOptions {
  /** 最大页面数 */
  maxPages?: number;
  /** 最大深度 */
  maxDepth?: number;
  /** URL 包含模式 */
  includePatterns?: string[];
  /** URL 排除模式 */
  excludePatterns?: string[];
  /** 请求延迟 (ms) */
  delayMs?: number;
  /** 超时 (ms) */
  timeoutMs?: number;
  /** 自定义 headers */
  headers?: Record<string, string>;
  /** 是否跟随重定向 */
  followRedirects?: boolean;
  /** CSS 选择器 (内容提取) */
  contentSelector?: string;
  /** CSS 选择器 (排除元素) */
  excludeSelectors?: string[];
}

/**
 * 文档页面
 */
export interface DocPage {
  /** 页面 ID */
  id: string;
  /** 来源 ID */
  sourceId: string;
  /** URL */
  url: string;
  /** 标题 */
  title: string;
  /** Markdown 内容 */
  content: string;
  /** 章节结构 */
  sections?: DocSection[];
  /** 抓取时间 */
  fetchedAt: number;
  /** 内容 hash */
  contentHash: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 文档章节
 */
export interface DocSection {
  /** 章节 ID (锚点) */
  id: string;
  /** 标题 */
  title: string;
  /** 层级 (1-6) */
  level: number;
  /** 内容 */
  content: string;
  /** 起始位置 */
  startOffset: number;
  /** 结束位置 */
  endOffset: number;
}

/**
 * 文档索引器配置
 */
export interface DocIndexerConfig {
  /** 用户代理 */
  userAgent?: string;
  /** 默认抓取选项 */
  defaultCrawlOptions?: CrawlOptions;
  /** 块大小 (tokens) */
  chunkTokens?: number;
  /** 块重叠 (tokens) */
  overlapTokens?: number;
  /** 并发数 */
  concurrency?: number;
  /** 缓存目录 */
  cacheDir?: string;
  /** 缓存有效期 (ms) */
  cacheTtl?: number;
}

/**
 * 默认配置
 */
export const DEFAULT_DOC_INDEXER_CONFIG: DocIndexerConfig = {
  userAgent: 'AI-Stack-Bot/1.0 (+https://github.com/anthropics/ai-stack)',
  defaultCrawlOptions: {
    maxPages: 100,
    maxDepth: 3,
    delayMs: 500,
    timeoutMs: 30000,
    followRedirects: true,
  },
  chunkTokens: 400,
  overlapTokens: 80,
  concurrency: 2,
  cacheTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

---

## 5. 核心接口

### 5.1 CodeIndexer

```typescript
// code/indexer.ts

import type { SemanticStoreInstance } from '@ai-stack/memory-store-sqlite';

export interface CodeIndexerInstance {
  /** 初始化 */
  initialize(): Promise<void>;

  /** 关闭 */
  close(): Promise<void>;

  /** 索引单个文件 */
  indexFile(filePath: string): Promise<IndexResult>;

  /** 索引整个目录 */
  indexDirectory(options?: { force?: boolean }): Promise<IndexSummary>;

  /** 增量更新 (基于文件变更) */
  updateIndex(changedFiles: string[]): Promise<IndexSummary>;

  /** 删除文件索引 */
  removeFile(filePath: string): Promise<void>;

  /** 搜索代码 */
  search(query: string, options?: CodeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** 获取索引状态 */
  getStatus(): Promise<IndexStatusSummary>;

  /** 获取文件索引状态 */
  getFileStatus(filePath: string): Promise<IndexStatus | null>;

  /** 清除所有索引 */
  clear(): Promise<void>;

  /** 启动文件监听 */
  startWatching(): void;

  /** 停止文件监听 */
  stopWatching(): void;

  /** 监听器是否运行中 */
  isWatching(): boolean;

  /** 设置语义存储 */
  setStore(store: SemanticStoreInstance): void;
}

export interface IndexResult {
  filePath: string;
  success: boolean;
  chunksAdded: number;
  chunksRemoved: number;
  durationMs: number;
  error?: string;
}

export interface IndexSummary {
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  chunksAdded: number;
  chunksRemoved: number;
  totalDurationMs: number;
  errors: Array<{ file: string; error: string }>;
}

export interface IndexStatusSummary {
  totalFiles: number;
  indexedFiles: number;
  pendingFiles: number;
  errorFiles: number;
  totalChunks: number;
  lastIndexedAt?: number;
}

/**
 * 创建代码索引器
 */
export function createCodeIndexer(config: CodeIndexerConfig): CodeIndexerInstance;
```

### 5.2 DocIndexer

```typescript
// doc/indexer.ts

export interface DocIndexerInstance {
  /** 初始化 */
  initialize(): Promise<void>;

  /** 关闭 */
  close(): Promise<void>;

  /** 添加文档源 */
  addSource(source: DocSourceInput): Promise<DocSource>;

  /** 移除文档源 */
  removeSource(sourceId: string): Promise<void>;

  /** 获取文档源 */
  getSource(sourceId: string): Promise<DocSource | null>;

  /** 列出所有文档源 */
  listSources(): Promise<DocSource[]>;

  /** 抓取单个源 */
  crawlSource(sourceId: string, options?: { force?: boolean }): Promise<CrawlResult>;

  /** 抓取所有源 */
  crawlAll(options?: { force?: boolean }): Promise<CrawlSummary>;

  /** 抓取单个 URL (不保存为源) */
  fetchUrl(url: string, options?: CrawlOptions): Promise<DocPage>;

  /** 搜索文档 */
  search(query: string, options?: DocSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** 获取页面 */
  getPage(pageId: string): Promise<DocPage | null>;

  /** 删除页面 */
  removePage(pageId: string): Promise<void>;

  /** 清除所有数据 */
  clear(): Promise<void>;

  /** 设置语义存储 */
  setStore(store: SemanticStoreInstance): void;
}

export interface CrawlResult {
  sourceId: string;
  pagesProcessed: number;
  pagesAdded: number;
  pagesUpdated: number;
  pagesFailed: number;
  chunksAdded: number;
  durationMs: number;
  errors: Array<{ url: string; error: string }>;
}

export interface CrawlSummary {
  sourcesProcessed: number;
  totalPagesProcessed: number;
  totalPagesAdded: number;
  totalPagesUpdated: number;
  totalPagesFailed: number;
  totalChunksAdded: number;
  totalDurationMs: number;
  results: CrawlResult[];
}

export type DocSourceInput = Omit<DocSource, 'id' | 'lastCrawledAt'>;

/**
 * 创建文档索引器
 */
export function createDocIndexer(config: DocIndexerConfig): DocIndexerInstance;
```

### 5.3 KnowledgeManager

```typescript
// manager.ts

import type { SemanticStoreInstance, EmbedFunction } from '@ai-stack/memory-store-sqlite';

export interface KnowledgeManagerConfig {
  /** 代码索引配置 */
  code?: CodeIndexerConfig & { enabled?: boolean };

  /** 文档索引配置 */
  doc?: DocIndexerConfig & { enabled?: boolean };

  /** 混合搜索配置 */
  search?: {
    /** 默认权重 */
    defaultWeights?: { fts: number; vector: number };
    /** 默认结果数量 */
    defaultLimit?: number;
    /** 时间衰减配置 */
    temporalDecay?: {
      enabled?: boolean;
      halfLifeDays?: number;
    };
    /** MMR 去重配置 */
    mmr?: {
      enabled?: boolean;
      lambda?: number;
    };
  };
}

export interface KnowledgeManagerInstance {
  /** 初始化 */
  initialize(): Promise<void>;

  /** 关闭 */
  close(): Promise<void>;

  /** 获取代码索引器 */
  getCodeIndexer(): CodeIndexerInstance | undefined;

  /** 获取文档索引器 */
  getDocIndexer(): DocIndexerInstance | undefined;

  /** 统一搜索 (代码 + 文档 + 可选记忆) */
  search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** 搜索代码 */
  searchCode(query: string, options?: CodeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** 搜索文档 */
  searchDocs(query: string, options?: DocSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** 索引代码库 */
  indexCode(options?: { force?: boolean }): Promise<IndexSummary>;

  /** 抓取文档 */
  crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary>;

  /** 添加文档源 */
  addDocSource(source: DocSourceInput): Promise<DocSource>;

  /** 移除文档源 */
  removeDocSource(sourceId: string): Promise<void>;

  /** 获取统计信息 */
  getStats(): Promise<KnowledgeStats>;

  /** 清除所有数据 */
  clear(): Promise<void>;

  /** 设置语义存储 (复用 Memory 的存储) */
  setStore(store: SemanticStoreInstance): void;

  /** 设置 embedding 函数 */
  setEmbedFunction(fn: EmbedFunction): void;
}

export interface KnowledgeStats {
  code: {
    enabled: boolean;
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt?: number;
  };
  doc: {
    enabled: boolean;
    totalSources: number;
    totalPages: number;
    totalChunks: number;
    lastCrawledAt?: number;
  };
}

/**
 * 创建知识管理器
 */
export function createKnowledgeManager(
  config: KnowledgeManagerConfig
): KnowledgeManagerInstance;
```

---

## 6. 实现细节

### 6.1 代码切分策略 (chunker.ts)

```typescript
/**
 * 代码切分策略
 *
 * 优先级:
 * 1. 按符号边界切分 (函数、类、接口)
 * 2. 超大符号按行数/token 切分
 * 3. 保留上下文 (imports, 父符号签名)
 */
export interface ChunkerInstance {
  /** 切分文件 */
  chunkFile(filePath: string, content: string, language: string): CodeBlock[];

  /** 支持的语言 */
  getSupportedLanguages(): string[];

  /** 检测文件语言 */
  detectLanguage(filePath: string): string;
}

/**
 * 创建切分器
 */
export function createChunker(config?: ChunkerConfig): ChunkerInstance;
```

**切分流程:**

```
文件内容
    │
    ▼
┌─────────────────────┐
│ 1. 语言检测         │
│    (扩展名/shebang) │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. 解析 AST         │
│    (tree-sitter 或  │
│     正则 fallback)  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. 符号提取         │
│    - 函数          │
│    - 类            │
│    - 接口          │
│    - 类型          │
└─────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ 4. 智能切分                 │
│    - 小符号 → 单独块        │
│    - 大符号 → 按 token 切分 │
│    - 保留签名 + docComment  │
└─────────────────────────────┘
    │
    ▼
返回 CodeBlock[]
```

### 6.2 文档爬取 (crawler.ts)

```typescript
/**
 * 文档爬取器
 */
export interface CrawlerInstance {
  /** 抓取单个 URL */
  fetch(url: string, options?: CrawlOptions): Promise<DocPage>;

  /** 抓取 sitemap */
  crawlSitemap(sitemapUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage>;

  /** 递归抓取 */
  crawlRecursive(startUrl: string, options?: CrawlOptions): AsyncGenerator<DocPage>;

  /** 停止抓取 */
  stop(): void;
}

/**
 * 创建爬取器
 */
export function createCrawler(config?: CrawlerConfig): CrawlerInstance;
```

**爬取流程:**

```
URL
    │
    ▼
┌─────────────────────┐
│ 1. 请求页面         │
│    - User-Agent    │
│    - 重定向处理     │
│    - 超时控制       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. 内容提取         │
│    - CSS Selector  │
│    - 排除元素       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. HTML → Markdown  │
│    - 保留标题结构   │
│    - 代码块格式化   │
│    - 链接处理       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. 章节解析         │
│    - 按 H1-H6 分段 │
│    - 生成锚点 ID    │
└─────────────────────┘
    │
    ▼
返回 DocPage
```

### 6.3 混合搜索 (hybrid-search.ts)

```typescript
/**
 * 混合搜索实现
 *
 * 复用 SemanticStore 的 hybrid search + 扩展 reranking
 */
export interface HybridSearchInstance {
  /** 执行搜索 */
  search(
    query: string,
    store: SemanticStoreInstance,
    options?: HybridSearchOptions
  ): Promise<KnowledgeSearchResult[]>;
}

/**
 * 搜索流程:
 *
 * 1. FTS 搜索 (BM25)
 * 2. Vector 搜索 (cosine similarity)
 * 3. 结果合并 (weighted scoring)
 * 4. 时间衰减 (复用 ranking/temporal-decay.ts)
 * 5. MMR 去重 (复用 ranking/mmr.ts)
 * 6. 结果截断
 */
```

---

## 7. 与 Agent 集成

### 7.1 Agent 配置扩展

```typescript
// @ai-stack/agent 配置扩展

interface AgentConfig {
  // ... 现有配置

  /** 知识库配置 */
  knowledge?: {
    enabled?: boolean;

    /** 代码索引 */
    code?: {
      enabled?: boolean;
      rootDir?: string;
      include?: string[];
      exclude?: string[];
      watch?: boolean;
    };

    /** 文档索引 */
    doc?: {
      enabled?: boolean;
      sources?: DocSourceInput[];
      autoRefresh?: boolean;
      refreshInterval?: number;
    };

    /** 搜索配置 */
    search?: {
      autoSearch?: boolean;       // 对话时自动搜索
      minRelevanceScore?: number; // 最小相关度阈值
      maxResults?: number;        // 最大结果数
    };
  };
}
```

### 7.2 Agent Tools

```typescript
// 代码搜索工具
const codeSearchTool: Tool = {
  name: 'search_code',
  description: 'Search the codebase for relevant code snippets, functions, classes, etc.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      languages: { type: 'array', items: { type: 'string' }, description: 'Filter by languages' },
      filePatterns: { type: 'array', items: { type: 'string' }, description: 'Glob patterns' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const results = await knowledgeManager.searchCode(args.query, args);
    return formatCodeResults(results);
  },
};

// 文档搜索工具
const docSearchTool: Tool = {
  name: 'search_docs',
  description: 'Search indexed documentation for relevant information.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      sources: { type: 'array', items: { type: 'string' }, description: 'Filter by source IDs' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const results = await knowledgeManager.searchDocs(args.query, args);
    return formatDocResults(results);
  },
};
```

### 7.3 Skills (用户命令)

```bash
# 代码索引
/index                    # 索引当前目录
/index --force            # 强制重新索引
/index status             # 查看索引状态

# 文档管理
/doc add <url>            # 添加文档源
/doc add <url> --name "React Docs"
/doc list                 # 列出所有文档源
/doc remove <id>          # 移除文档源
/doc crawl                # 抓取所有文档
/doc crawl <id>           # 抓取指定文档源
/doc status               # 查看抓取状态
```

---

## 8. 存储设计

### 8.1 复用 SemanticStore

Knowledge 数据存储在 `semantic_chunks` 表中，通过 `sourceType` 和 `metadata` 区分:

```typescript
// 代码块存储
const codeChunk: SemanticChunkInput = {
  text: codeBlock.content,
  tags: ['code', codeBlock.language, codeBlock.symbolType],
  sourceType: 'code',
  sessionId: undefined, // 代码不属于特定 session
  metadata: {
    filePath: codeBlock.filePath,
    language: codeBlock.language,
    symbolName: codeBlock.symbolName,
    symbolType: codeBlock.symbolType,
    startLine: codeBlock.startLine,
    endLine: codeBlock.endLine,
    signature: codeBlock.signature,
  },
};

// 文档块存储
const docChunk: SemanticChunkInput = {
  text: section.content,
  tags: ['doc', source.name, ...(source.tags || [])],
  sourceType: 'doc',
  sessionId: undefined,
  metadata: {
    sourceId: source.id,
    url: page.url,
    title: page.title,
    section: section.title,
    fetchedAt: page.fetchedAt,
  },
};
```

### 8.2 索引状态表 (新增)

```sql
-- 代码文件索引状态
CREATE TABLE IF NOT EXISTS knowledge_code_index (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  indexed_at INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'indexed',
  error TEXT
);

-- 文档源
CREATE TABLE IF NOT EXISTS knowledge_doc_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  crawl_options TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_crawled_at INTEGER,
  refresh_interval INTEGER,
  created_at INTEGER NOT NULL
);

-- 文档页面
CREATE TABLE IF NOT EXISTS knowledge_doc_pages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (source_id) REFERENCES knowledge_doc_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_source ON knowledge_doc_pages(source_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_url ON knowledge_doc_pages(url);
```

---

## 9. 依赖关系

```
@ai-stack/knowledge
    │
    ├── @ai-stack/memory-store-sqlite (workspace:*)
    │   └── (复用 SemanticStore, EmbeddingCache, types)
    │
    ├── @ai-stack/memory (workspace:*)
    │   └── (复用 ranking pipeline: temporal-decay, mmr)
    │
    ├── node-html-markdown (^1.3.0)
    │   └── HTML → Markdown 转换
    │
    ├── glob (^11.0.0)
    │   └── 文件 glob 匹配
    │
    └── chokidar (^4.0.0)
        └── 文件监听
```

**package.json**:

```json
{
  "name": "@ai-stack/knowledge",
  "version": "0.0.1",
  "description": "Code and documentation indexing for AI Stack",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "dependencies": {
    "@ai-stack/memory-store-sqlite": "workspace:*",
    "@ai-stack/memory": "workspace:*",
    "node-html-markdown": "^1.3.0",
    "glob": "^11.0.0",
    "chokidar": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsup": "^8.3.5",
    "typescript": "~5.7.2",
    "vitest": "^2.1.0"
  }
}
```

---

## 10. 实现路线图

### Phase 1: 基础框架
- [ ] 创建包结构
- [ ] 定义类型
- [ ] 实现 KnowledgeManager 骨架

### Phase 2: 代码索引
- [ ] 实现 chunker (通用 + TypeScript)
- [ ] 实现 CodeIndexer
- [ ] 实现文件监听 (watcher)

### Phase 3: 文档索引
- [ ] 实现 crawler
- [ ] 实现 HTML parser
- [ ] 实现 DocIndexer

### Phase 4: 检索增强
- [ ] 集成 ranking pipeline
- [ ] 实现 reranker
- [ ] 优化 hybrid search

### Phase 5: Agent 集成
- [ ] 添加 Tools
- [ ] 添加 Skills
- [ ] 配置支持

---

## 11. 使用示例

```typescript
import { createKnowledgeManager } from '@ai-stack/knowledge';
import { createSqliteStores } from '@ai-stack/memory-store-sqlite';

// 创建存储
const stores = await createSqliteStores({ dbPath: './knowledge.db' });

// 创建知识管理器
const knowledge = createKnowledgeManager({
  code: {
    enabled: true,
    rootDir: './src',
    include: ['**/*.ts', '**/*.tsx'],
    watch: true,
  },
  doc: {
    enabled: true,
  },
});

// 设置存储和 embedding 函数
knowledge.setStore(stores.semantic);
knowledge.setEmbedFunction(async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
});

await knowledge.initialize();

// 索引代码
await knowledge.indexCode();

// 添加文档源
await knowledge.addDocSource({
  name: 'React Docs',
  type: 'url',
  url: 'https://react.dev/reference/react',
  tags: ['react', 'frontend'],
  enabled: true,
});

// 抓取文档
await knowledge.crawlDocs();

// 统一搜索
const results = await knowledge.search('useEffect cleanup', {
  sources: ['code', 'doc'],
  limit: 10,
});

console.log(results);
// [
//   { chunk: { text: '...', sourceType: 'code', ... }, score: 0.95, ... },
//   { chunk: { text: '...', sourceType: 'doc', ... }, score: 0.87, ... },
// ]

// 清理
await knowledge.close();
```
