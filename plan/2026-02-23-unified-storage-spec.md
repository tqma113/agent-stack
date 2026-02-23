# 统一存储规范方案

## 执行状态：已完成 ✓

执行日期：2026-02-23

## Context

当前 AI Stack 三个 example 项目的存储目录和格式不一致：
- **Agent**: `memory/sqlite.db`, `knowledge/sqlite.db`
- **Assistant**: `MEMORY.md`, `memory/*.md`, `index.db`, `scheduler.json`
- **Code**: `history/sqlite.db`, `tasks/sqlite.db`

这导致：
1. 用户难以理解和管理数据文件
2. `.gitignore` 配置复杂
3. 数据迁移/备份不便
4. 开发者认知负担增加

## 设计目标

1. **统一根目录名** - 都使用 `.ai-stack` 作为存储目录名
2. **按定位区分位置** - 项目级工具用 `./`，个人助手用 `~/`
3. **按功能分层** - 子目录按功能模块划分
4. **保持灵活性** - 支持自定义路径覆盖
5. **向后兼容** - 不破坏现有配置

## 最终目录结构

### 默认存储位置

| 包 | 定位 | 默认根目录 | 原因 |
|----|------|-----------|------|
| `@ai-stack/agent` | 项目级工具 | `./.ai-stack` | 数据跟随项目 |
| `@ai-stack/code` | 项目级工具 | `./.ai-stack` | 数据跟随项目 |
| `@ai-stack/assistant` | 个人助手 | `~/.ai-stack` | 跨项目共享 |

### Agent/Code 项目 (项目目录)

```
my-project/
├── .ai-stack/
│   ├── memory/sqlite.db      # Agent 记忆
│   ├── knowledge/sqlite.db   # Agent 知识库
│   ├── history/sqlite.db     # Code 文件历史
│   └── tasks/sqlite.db       # Code 任务
├── src/
└── package.json
```

### Assistant (用户目录)

```
~/.ai-stack/
├── memory/
│   ├── MEMORY.md             # 长期记忆
│   ├── sqlite.db             # 搜索索引
│   └── logs/
│       └── 2026-02-23.md     # 每日日志
└── scheduler/
    └── jobs.json             # 调度任务
```

## 已修改文件

| 文件 | 修改内容 |
|------|----------|
| `packages/libs/agent/src/agent.ts` | 更新 memory/knowledge 默认路径 |
| `packages/libs/assistant/src/config.ts` | 更新 DEFAULT_BASE_DIR 和路径默认值 |
| `packages/libs/code/src/config.ts` | 更新 DEFAULT_BASE_DIR 和路径默认值 |
| `packages/examples/agent/agent.json` | 更新 knowledge.dbPath |
| `packages/examples/assistant/assistant.json` | 移除显式路径，使用默认值 |
| `packages/libs/assistant/src/scheduler/scheduler.ts` | 更新默认 persistencePath |
| `packages/examples/code/code.json` | 更新 history 和 tasks 路径 |
| `packages/examples/agent/.gitignore` | 更新忽略规则 |
| `packages/examples/assistant/.gitignore` | 更新忽略规则 |
| `packages/examples/code/.gitignore` | 更新忽略规则 |
| `spec/project-structure.md` | 更新文档 |

## 清理的旧数据

- `packages/examples/agent/memory/`
- `packages/examples/agent/knowledge/`
- `packages/examples/assistant/memory/`
- `packages/examples/assistant/MEMORY.md`
- `packages/examples/assistant/index.db`
- `packages/examples/code/history/`
- `packages/examples/code/tasks/`

## 验证结果

- ✓ `rush build` 成功
- ✓ 所有包编译通过

## 文档更新

- `spec/project-structure.md` - 新增第 9 节「数据存储目录结构」，详细说明：
  - 9.1 存储位置规范
  - 9.2 Agent 存储结构
  - 9.3 Code 存储结构
  - 9.4 Assistant 存储结构
  - 9.5 存储汇总对比
  - 9.6 .gitignore 配置
