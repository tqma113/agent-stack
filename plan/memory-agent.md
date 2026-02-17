下面给你一份“在单个 agent 内用 Claude Code 落地 memory 全能力”的实现思路总结 + 可执行 plan（偏工程落地，按里程碑拆）。

---

## 实现思路总结（在 agent 内“一体化 memory 内核”）

把 memory 当成 agent 的一个 **MemoryManager 子系统**，核心只做四件事：

1. **Observe（采集）**
   每轮把：用户输入、assistant 输出、工具调用入参/结果、关键决策、任务状态变化 → 统一写入“事件流（event stream）”。

2. **Decide Write（写入裁决）**
   从事件流里抽取候选记忆（facts / preferences / decisions / todos / artifacts），再用规则+轻量模型判断写入到哪一层：

* Working/Task State（结构化状态，强一致）
* Summary（滚动摘要，控制上下文）
* Episodic（事件日志，可追溯）
* Semantic（可检索材料，向量/全文）
* Profile KV（硬偏好，结构化）

3. **Retrieve（读出检索）**
   每次生成回复前，按固定顺序取回：
   Profile KV → Task State → Episodic(top-k) → Semantic(top-k，多路召回+重排)
   输出一个 **MemoryBundle**（可注入包），带来源/时间/置信度。

4. **Inject（注入模板）**
   用固定模板把 MemoryBundle 注入到 prompt 的专用区，并严格控制 token 预算和优先级（硬约束永远优先）。

> Claude Code 的定位：让它写代码/跑测试/重构都很强；你要做的是把 memory 的“结构、规则、时序、schema”定义清晰，然后让 Claude Code按计划把模块落出来。

---

## Plan（按 7 个里程碑，从 MVP 到“全能力”）

我给你拆成 7 个阶段，每阶段都有明确产出与验收标准。

### Milestone 0：定义 schema + 目录结构（1 次性）

**产出**

* `memory/` 模块目录
* 统一数据结构（JSON schema / TS types / Python dataclass，选你栈）
* 记忆层级定义与优先级

**建议最小 schema**

* `ProfileItem { key, value, updated_at, confidence, source_event_id }`
* `TaskState { goal, constraints[], plan[], done[], blocked[], next_action, updated_at, version }`
* `Event { id, ts, type, intent, entities[], summary, payload, links[] }`
* `SemanticChunk { id, ts, text, tags[], source_event_id }`
* `Summary { ts, short, bullets[], decisions[], todos[] }`
* `MemoryBundle { profile, task_state, recent_events[], retrieved_chunks[], warnings[] }`

**验收**

* 任意一轮对话都能被落到 `Event`，并能回放。

---

### Milestone 1：Working Memory + Task State（先做强一致）

**目标**：执行型能力先稳定，避免重复/漏做。

**实现**

* `TaskStateStore`：本地持久化（SQLite/JSON 文件都行，先选 SQLite）
* `StateReducer`：根据事件更新状态（像 Redux reducer 一样）
* 幂等键：工具调用/步骤写入带 `action_id` 防重复
* 版本号：`version++` + 可回滚快照（至少保留最近 N 个版本）

**验收**

* 连续多轮任务：不会重复执行同一步；能正确更新 `done/next_action`。

---

### Milestone 2：滚动摘要 Summary（上下文压缩核心）

**实现**

* `Summarizer`：每 N 轮或 token 超阈值触发
* 输出结构化 summary：`short + bullets + decisions + todos`
* 保留 “硬约束/决定/下一步”，丢掉闲聊细节
* 保存到 `SummaryStore`（同样 SQLite）

**验收**

* 200+ 轮对话后仍能准确复述：目标、约束、已决策、下一步。

---

### Milestone 3：Episodic（事件日志 + 可追溯）

**实现**

* `EventStore`：写入所有事件（对话、工具、决策）
* `EventType` 分类：`USER_MSG | ASSISTANT_MSG | TOOL_CALL | TOOL_RESULT | DECISION | STATE_CHANGE`
* 每个事件可挂载 link（例如文件路径、外部资源 id）

**验收**

* 能按时间线导出某个任务全过程（审计/复盘）。

---

### Milestone 4：Profile KV（偏好画像，硬注入）

**实现**

* `ProfileStore`：KV + 冲突策略（最新优先 / 置信度 / 显式优先）
* Write policy：只允许白名单 key（language/tone/unit/禁忌/输出格式…）
* 更新必须记录来源事件 id（可追溯）

**验收**

* 用户说“以后用中文+表格总结”后，后续任务稳定生效且可被用户删除/修改。

---

### Milestone 5：Semantic Memory（可检索材料）

这里分两步做，先全文再向量（MVP快，风险低）。

**Step A：全文检索（BM25/FTS）**

* SQLite FTS5（很省事）存 `SemanticChunk.text`
* 召回：关键词 + tags + 时间过滤（近 30 天加权）

**Step B：向量检索（可选）**

* 如果你不想引入复杂依赖：先用本地 embedding 模型/服务；或暂时只做全文
* 向量库：FAISS/Chroma/pgvector（选一个你顺手的）
* 再加一个简单 rerank（基于 overlap / 规则；或用 LLM 评分）

**验收**

* 用户问“上次我们选方案 B 的原因？”能检索到对应 decision/event/chunk，并引用时间戳。

---

### Milestone 6：Read Policy + Injection（让 agent “用对记忆”）

**实现**

* `MemoryRetriever`：按优先级组装 `MemoryBundle`

  1. Profile（硬约束）
  2. TaskState（目标/下一步）
  3. Recent Episodic（最近相关事件 top-k）
  4. Semantic（多路召回 top-k + 重排）
* `Budgeter`：每层 token 预算（例如 Profile 200、Task 300、Events 500、Chunks 800）
* `Injector`：固定模板（强烈建议）：

示例模板（思路）

* 用户偏好（硬约束）
* 当前任务状态
* 近期相关事件（带时间）
* 相关材料片段（带来源）
* 冲突/不确定性提示（warnings）

**验收**

* 在“新问题”场景不会乱注入旧任务记忆；在“延续任务”场景不会丢关键约束。

---

### Milestone 7：Write Policy（防噪声、防漂移、过期与冲突）

**实现**

* `WritePolicyEngine`：规则优先 + 可选 LLM 分类器
* 规则：高复用/高稳定/高成本/高价值结论 才写长期
* 时间衰减：旧记忆降权；过期 key 自动标记 stale
* 冲突检测：同 key 多值 → 标记冲突并偏向最新/显式
* 隐私最小化：敏感字段默认不落盘（除非用户显式要求）

**验收**

* 跑一个“长会话回归测试”：记忆不会无限膨胀；偏好稳定；旧信息不误导。

---

## Claude Code 具体使用方式（你在项目里怎么驱动它）

你可以按下面节奏用 Claude Code：

1. 先让它生成 **`memory/README.md`**：写清楚 schema、层级、时序图、接口
2. 然后逐 milestone 让它：

   * 生成模块骨架（store / reducer / retriever / injector）
   * 写单测（最重要：幂等、回滚、预算、冲突）
   * 写一套回归脚本：模拟 500 轮对话 + 工具调用
3. 每个阶段都用测试卡住行为，不然记忆系统很容易“看起来能跑，实际上漂”。

---

## 你可以直接给 Claude Code 的任务拆解清单（可复制）

* [ ] 建立 `memory/` 目录与 types/schema（TS or Python）
* [ ] 实现 `EventStore`（SQLite）+ 写入所有事件
* [ ] 实现 `TaskStateStore` + `StateReducer` + 幂等 action_id
* [ ] 实现 `Summarizer` + `SummaryStore`（结构化输出）
* [ ] 实现 `ProfileStore`（KV 白名单 + 冲突策略）
* [ ] 实现 `SemanticStore`（先 FTS5，再可选向量）
* [ ] 实现 `MemoryRetriever`（多路召回 + 时间过滤 + top-k）
* [ ] 实现 `Budgeter`（token 预算）+ `Injector`（固定模板）
* [ ] 实现 `WritePolicyEngine`（规则 + 可选分类器）
* [ ] 单测与回归：幂等、冲突、过期、检索相关性、注入预算

---

如果你告诉我你现在的技术栈（Node/TS 还是 Python？本地还是服务端？要不要 SQLite？），我可以把上面 plan 进一步变成**具体到文件级别的目录树 + 每个文件的接口签名 + Claude Code 的逐步提示词（prompts）**，你直接照着让它生成即可。
