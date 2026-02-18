# 工具执行型 Agent 改造计划（修订版 v3）

## 核心原则

> **Agent 框架本身不包含任何工具实现，所有工具通过 Skill 或 MCP 配置加载**

Agent-stack 是一个**纯框架**，提供：
1. LLM 交互能力（OpenAI API 封装）
2. 工具调用协调
3. Skill 加载系统
4. MCP 集成
5. CLI 交互界面

工具的实际实现由**用户配置的外部 Skill/MCP** 提供。

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Stack Framework                     │
├─────────────────────────────────────────────────────────────┤
│  @ai-stack/provider   - OpenAI API 封装                   │
│  @ai-stack/mcp        - MCP 协议集成                      │
│  @ai-stack/skill      - Skill 加载系统                    │
│  @ai-stack/agent      - Agent 核心 + CLI                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │         用户配置               │
              └───────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────┐         ┌─────────────────────────────┐
│     MCP Servers     │         │          Skills             │
│  (外部配置)          │         │      (用户配置目录)          │
├─────────────────────┤         ├─────────────────────────────┤
│ - .mcp.json 配置     │         │ - skills/ 目录              │
│ - web_search        │         │ - file_skill/               │
│ - database          │         │ - shell_skill/              │
│ - ...               │         │ - ...                       │
└─────────────────────┘         └─────────────────────────────┘
```

---

## 改造内容

### 1. 增强 CLI

重构 `packages/index/src/cli.ts`，提供：

```bash
# 交互式聊天（自动加载 agent.json 配置）
ai-stack chat [--config=PATH]

# 单次执行任务
ai-stack run "<task>" [--config=PATH]

# 列出已加载的工具
ai-stack tools list

# 查看工具详情
ai-stack tools info <name>

# 配置管理
ai-stack config init      # 生成配置模板
ai-stack config show      # 显示当前配置
```

### 2. 配置文件支持

支持 `agent.json` 或 `agent.json`：

```json
{
  "model": "gpt-4o",
  "systemPrompt": "You are a helpful assistant with access to tools...",
  "skill": {
    "directories": ["./skills"],
    "autoLoad": true
  },
  "mcp": {
    "configPath": ".mcp.json"
  }
}
```

### 3. 示例 Skills（放在 examples 目录）

在 `examples/` 目录提供示例 Skills，用户可以复制使用：

```
examples/
├── skills/
│   ├── file-skill/          # 文件操作示例
│   │   ├── skill.json
│   │   └── handlers.js
│   ├── shell-skill/         # Shell 命令示例
│   │   ├── skill.json
│   │   └── handlers.js
│   └── search-skill/        # 搜索示例
│       ├── skill.json
│       └── handlers.js
└── basic/                   # 现有示例
```

---

## 任务清单

### Phase 1: 增强 CLI

- [x] 添加 CLI 依赖 (commander)
- [x] 重构 cli.ts，实现命令式结构
- [x] 实现 `chat` 命令（交互式）
- [x] 实现 `run` 命令（单次执行）
- [x] 实现 `tools` 命令组
- [x] 实现 `config` 命令组

### Phase 2: 配置文件支持

- [x] 创建 config.ts - 配置加载逻辑
- [x] CLI 自动读取配置文件
- [x] 配置验证

### Phase 3: 示例 Skills 和 Examples

- [x] 创建 file-skill 示例
- [x] 创建 shell-skill 示例
- [x] 创建 search-skill 示例
- [x] 更新 examples/basic 目录
  - [x] index.ts - 基础示例
  - [x] chat.ts - 交互式聊天
  - [x] with-skills.ts - Skills 使用示例
  - [x] with-config.ts - 配置文件使用示例
  - [x] tool-agent.ts - 完整工具执行型 Agent
- [x] 创建 agent.json 示例配置
- [x] 更新 README.md 文档

### Phase 4: 文档更新

- [x] 更新 spec/*.md 文档

---

## CLI 详细设计

### chat 命令

```bash
ai-stack chat [options]

Options:
  --config <path>    配置文件路径（默认：agent.json）
  --model <name>     LLM 模型（覆盖配置）
  --mcp <path>       MCP 配置文件路径
  --skill <dir>      Skill 目录（可多次指定）
  --no-stream        禁用流式输出
```

### run 命令

```bash
ai-stack run "<task>" [options]

Options:
  --config <path>    配置文件路径
  --model <name>     LLM 模型
  --yes, -y          跳过危险命令确认
  --json             以 JSON 格式输出
```

### tools 命令

```bash
ai-stack tools list           # 列出所有工具
ai-stack tools info <name>    # 显示工具详情
```

### config 命令

```bash
ai-stack config init          # 生成配置模板
ai-stack config show          # 显示当前配置
```

---

## 配置文件详细设计

```json
{
  "$schema": "https://ai-stack.dev/schema/config.json",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful assistant...",

  "skill": {
    "directories": ["./skills", "~/.ai-stack/skills"],
    "skills": {
      "my-skill": {
        "path": "./my-custom-skill",
        "enabled": true,
        "config": {}
      }
    },
    "autoLoad": true
  },

  "mcp": {
    "configPath": ".mcp.json",
    "autoConnect": true
  },

  "security": {
    "confirmDangerousCommands": true
  }
}
```

---

## 关键修改文件

| 文件 | 操作 |
|------|------|
| `packages/index/package.json` | 添加 CLI 依赖 |
| `packages/index/src/cli.ts` | 重写为命令式 CLI |
| `packages/index/src/config.ts` | 新建配置文件加载 |
| `packages/index/src/index.ts` | 导出配置相关函数 |
| `examples/skills/*` | 新建示例 Skills |
| `spec/*.md` | 更新文档 |

---

## 验证方式

1. `rush build` 构建成功
2. CLI 命令正常工作：
   ```bash
   ai-stack config init
   ai-stack chat
   ai-stack run "hello"
   ai-stack tools list
   ```
3. 配置文件正确加载
4. 示例 Skills 可被加载和使用
