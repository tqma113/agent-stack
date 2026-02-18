[x] knowledge 支持去重，默认情况下 indexing 过的内容不再 indexing

[ ] multiagent 支持多个 agent 组合

[ ] 能实现类似 ComfyUI 的多 Agent 编排吗？类似 workflow？
  [ ] 不同 agent 配置不同模型、MCP、Skill
[ ] model、MCP、Skill 图形界面圈选（上下文控制，执行效率和准确率更高）
  [ ] 这一步由 AI 代替？
[x] 权限管控
[ ] Agent
  [ ] AGENT.md 是什么？有什么用？最佳实践是什么？
  [ ] iteration
  [ ] multi sub task/agent 并行提效
  [ ] loop 的最佳实践

[ ] Personal Assitant
  [ ] Calander + Task 管理
  [ ] Corn Job
    [ ] AI 新闻、事件、仓库、论文、趋势
[ ] OpenClaw
  [ ] Profile/Task/Summary/Episodic/Semantic 是什么？有什么用？最佳实践是什么？
  [ ] Markdown 文件 持久化
  [ ] BM25 + Vector 的特点和优势

[ ] multi agent X model provider X MCP/Skill
[x] 我们支持了 maxIterations，目前达到限制之后任务会自动停止，我希望当达到限制之后中止然后询问用户是否继续，而不是直接终止