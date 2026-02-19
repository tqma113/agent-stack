# Electron CDP MCP

通过 Chrome DevTools Protocol (CDP) 控制 Electron 应用的 MCP 服务器。

## 前置条件

Electron 应用需要启动时开启远程调试端口：

```bash
# 方式 1: 命令行启动
electron --remote-debugging-port=9222 your-app

# 方式 2: 在 Electron 主进程中设置
app.commandLine.appendSwitch('remote-debugging-port', '9222');

# 方式 3: 环境变量
ELECTRON_ENABLE_LOGGING=1 electron --remote-debugging-port=9222 your-app
```

## 安装

```bash
cd electron-cdp-mcp
npm install
npm run build
```

## 在 Claude Code 中使用

在项目的 `.mcp.json` 中添加配置：

```json
{
  "mcpServers": {
    "electron-cdp": {
      "command": "node",
      "args": ["/path/to/electron-cdp-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

或者使用 npx 运行（发布后）：

```json
{
  "mcpServers": {
    "electron-cdp": {
      "command": "npx",
      "args": ["-y", "electron-cdp-mcp"]
    }
  }
}
```

## 可用工具 (142 个)

### 连接管理

| 工具 | 描述 |
|------|------|
| `electron_connect` | 连接到 Electron 应用 |
| `electron_disconnect` | 断开连接 |
| `electron_list_targets` | 列出所有可调试目标 |
| `electron_status` | 获取当前连接状态 |

### 页面导航

| 工具 | 描述 |
|------|------|
| `electron_navigate` | 导航到指定 URL |
| `electron_reload` | 刷新页面 |
| `electron_go_back` | 后退 |
| `electron_go_forward` | 前进 |

### 截图

| 工具 | 描述 |
|------|------|
| `electron_screenshot` | 截取当前页面截图 |

### JavaScript 执行

| 工具 | 描述 |
|------|------|
| `electron_evaluate` | 执行 JavaScript 表达式 |
| `electron_call_function` | 调用 JavaScript 函数 |

### DOM 操作

| 工具 | 描述 |
|------|------|
| `electron_get_document` | 获取 DOM 文档树 |
| `electron_query_selector` | 使用 CSS 选择器查找元素 |
| `electron_query_selector_all` | 查找所有匹配的元素 |
| `electron_get_html` | 获取元素的 HTML |

### 输入操作

| 工具 | 描述 |
|------|------|
| `electron_click` | 点击元素或坐标 |
| `electron_type` | 输入文本 |
| `electron_press_key` | 按下键盘按键 |

### 网络/Cookie

| 工具 | 描述 |
|------|------|
| `electron_get_cookies` | 获取 cookies |
| `electron_set_cookie` | 设置 cookie |
| `electron_clear_cookies` | 清除所有 cookies |

### 模拟

| 工具 | 描述 |
|------|------|
| `electron_set_viewport` | 设置视口大小 |
| `electron_set_user_agent` | 设置 User Agent |

### 等待

| 工具 | 描述 |
|------|------|
| `electron_wait_for_selector` | 等待元素出现 |
| `electron_wait_for_navigation` | 等待页面导航完成 |
| `electron_wait_for_function` | 等待 JS 函数返回真值 |

### 页面信息

| 工具 | 描述 |
|------|------|
| `electron_get_page_info` | 获取页面 URL 和标题 |
| `electron_get_page_content` | 获取页面完整 HTML |

### 滚动

| 工具 | 描述 |
|------|------|
| `electron_scroll_to` | 滚动到指定坐标 |
| `electron_scroll_to_element` | 滚动元素到视图 |

### 元素交互

| 工具 | 描述 |
|------|------|
| `electron_get_bounding_box` | 获取元素位置和大小 |
| `electron_focus` | 聚焦元素 |
| `electron_select_option` | 选择下拉选项 |
| `electron_set_checked` | 设置复选框/单选框状态 |
| `electron_clear_input` | 清空输入框 |
| `electron_get_text` | 获取元素文本 |
| `electron_get_attribute` | 获取元素属性 |
| `electron_element_exists` | 检查元素是否存在 |
| `electron_is_visible` | 检查元素是否可见 |

### 高级输入

| 工具 | 描述 |
|------|------|
| `electron_double_click` | 双击元素或坐标 |
| `electron_hover` | 悬停在元素上 |
| `electron_drag_and_drop` | 拖放操作 |

### PDF 生成

| 工具 | 描述 |
|------|------|
| `electron_print_to_pdf` | 生成页面 PDF |

### 原始 CDP 命令

| 工具 | 描述 |
|------|------|
| `electron_execute_cdp` | 执行原始 CDP 命令 |

### Accessibility (无障碍)

| 工具 | 描述 |
|------|------|
| `electron_accessibility_get_tree` | 获取完整的无障碍树 |
| `electron_accessibility_query` | 按名称或角色查询无障碍节点 |

### Performance (性能)

| 工具 | 描述 |
|------|------|
| `electron_performance_enable` | 启用性能指标收集 |
| `electron_performance_get_metrics` | 获取性能指标 |
| `electron_performance_disable` | 禁用性能指标收集 |

### Profiler (CPU 分析)

| 工具 | 描述 |
|------|------|
| `electron_profiler_start` | 开始 CPU 性能分析 |
| `electron_profiler_stop` | 停止 CPU 性能分析并获取结果 |
| `electron_profiler_coverage_start` | 开始代码覆盖率收集 |
| `electron_profiler_coverage_stop` | 停止代码覆盖率收集 |
| `electron_profiler_coverage_best_effort` | 获取尽力而为的代码覆盖率 |

### Heap Profiler (堆分析)

| 工具 | 描述 |
|------|------|
| `electron_heap_enable` | 启用堆分析器 |
| `electron_heap_disable` | 禁用堆分析器 |
| `electron_heap_snapshot` | 拍摄堆快照 |
| `electron_heap_gc` | 强制垃圾回收 |
| `electron_heap_sampling_start` | 开始堆采样 |
| `electron_heap_sampling_stop` | 停止堆采样并获取结果 |

### Debugger (调试器)

| 工具 | 描述 |
|------|------|
| `electron_debugger_enable` | 启用调试器 |
| `electron_debugger_disable` | 禁用调试器 |
| `electron_debugger_set_breakpoint` | 设置断点 |
| `electron_debugger_remove_breakpoint` | 移除断点 |
| `electron_debugger_pause` | 暂停执行 |
| `electron_debugger_resume` | 恢复执行 |
| `electron_debugger_step_over` | 单步跳过 |
| `electron_debugger_step_into` | 单步进入 |
| `electron_debugger_step_out` | 单步跳出 |

### CSS

| 工具 | 描述 |
|------|------|
| `electron_css_enable` | 启用 CSS 代理 |
| `electron_css_disable` | 禁用 CSS 代理 |
| `electron_css_get_computed_style` | 获取计算样式 |
| `electron_css_get_inline_styles` | 获取内联样式 |
| `electron_css_get_matched_styles` | 获取匹配的 CSS 规则 |
| `electron_css_coverage_start` | 开始 CSS 覆盖率跟踪 |
| `electron_css_coverage_stop` | 停止 CSS 覆盖率跟踪 |

### Tracing (追踪)

| 工具 | 描述 |
|------|------|
| `electron_tracing_start` | 开始事件追踪 |
| `electron_tracing_stop` | 停止事件追踪 |
| `electron_tracing_get_categories` | 获取可用追踪类别 |

### Storage (存储)

| 工具 | 描述 |
|------|------|
| `electron_storage_clear` | 清除指定来源的存储 |
| `electron_storage_get_usage` | 获取存储使用情况和配额 |

### IndexedDB

| 工具 | 描述 |
|------|------|
| `electron_indexeddb_enable` | 启用 IndexedDB 代理 |
| `electron_indexeddb_disable` | 禁用 IndexedDB 代理 |
| `electron_indexeddb_list_databases` | 列出数据库 |
| `electron_indexeddb_request_data` | 请求对象存储数据 |
| `electron_indexeddb_delete_database` | 删除数据库 |

### ServiceWorker

| 工具 | 描述 |
|------|------|
| `electron_serviceworker_enable` | 启用 ServiceWorker 代理 |
| `electron_serviceworker_disable` | 禁用 ServiceWorker 代理 |
| `electron_serviceworker_unregister` | 注销 Service Worker |
| `electron_serviceworker_update` | 更新 Service Worker |
| `electron_serviceworker_stop` | 停止 Service Worker |

### Target (目标管理)

| 工具 | 描述 |
|------|------|
| `electron_target_get_targets` | 获取所有目标 |
| `electron_target_create` | 创建新目标（页面） |
| `electron_target_close` | 关闭目标 |
| `electron_target_activate` | 激活（聚焦）目标 |

### Browser (浏览器)

| 工具 | 描述 |
|------|------|
| `electron_browser_version` | 获取浏览器版本信息 |
| `electron_browser_get_window_bounds` | 获取窗口边界 |
| `electron_browser_set_window_bounds` | 设置窗口边界 |
| `electron_browser_set_download_behavior` | 设置下载行为 |

### System Info (系统信息)

| 工具 | 描述 |
|------|------|
| `electron_system_info` | 获取系统信息 |
| `electron_process_info` | 获取进程信息 |

### Memory (内存)

| 工具 | 描述 |
|------|------|
| `electron_memory_get_dom_counters` | 获取 DOM 计数器 |
| `electron_memory_force_gc` | 强制垃圾回收 |
| `electron_memory_sampling_start` | 开始内存采样 |
| `electron_memory_sampling_stop` | 停止内存采样 |
| `electron_memory_get_sampling_profile` | 获取内存采样配置 |

### Security (安全)

| 工具 | 描述 |
|------|------|
| `electron_security_enable` | 启用安全域 |
| `electron_security_disable` | 禁用安全域 |
| `electron_security_ignore_certificate_errors` | 忽略证书错误 |

### Overlay (覆盖层/可视化调试)

| 工具 | 描述 |
|------|------|
| `electron_overlay_enable` | 启用覆盖层 |
| `electron_overlay_disable` | 禁用覆盖层 |
| `electron_overlay_highlight_node` | 高亮 DOM 节点 |
| `electron_overlay_hide_highlight` | 隐藏高亮 |
| `electron_overlay_set_inspect_mode` | 设置检查模式 |
| `electron_overlay_show_fps_counter` | 显示 FPS 计数器 |
| `electron_overlay_show_paint_rects` | 显示绘制矩形 |

### Log (日志)

| 工具 | 描述 |
|------|------|
| `electron_log_enable` | 启用日志域 |
| `electron_log_disable` | 禁用日志域 |
| `electron_log_clear` | 清除日志 |
| `electron_log_start_violations` | 开始违规报告 |
| `electron_log_stop_violations` | 停止违规报告 |

### Fetch (请求拦截)

| 工具 | 描述 |
|------|------|
| `electron_fetch_enable` | 启用请求拦截 |
| `electron_fetch_disable` | 禁用请求拦截 |
| `electron_fetch_continue_request` | 继续被拦截的请求 |
| `electron_fetch_fail_request` | 使请求失败 |
| `electron_fetch_fulfill_request` | 用自定义响应完成请求 |

### Animation (动画)

| 工具 | 描述 |
|------|------|
| `electron_animation_enable` | 启用动画代理 |
| `electron_animation_disable` | 禁用动画代理 |
| `electron_animation_set_playback_rate` | 设置播放速率 |
| `electron_animation_get_playback_rate` | 获取播放速率 |
| `electron_animation_seek` | 跳转到指定时间 |
| `electron_animation_pause` | 暂停动画 |
| `electron_animation_release` | 释放动画 |

### Audits (审计)

| 工具 | 描述 |
|------|------|
| `electron_audits_enable` | 启用审计域 |
| `electron_audits_disable` | 禁用审计域 |
| `electron_audits_check_contrast` | 检查对比度 |
| `electron_audits_check_forms` | 检查表单问题 |

### LayerTree (图层树)

| 工具 | 描述 |
|------|------|
| `electron_layertree_enable` | 启用图层树代理 |
| `electron_layertree_disable` | 禁用图层树代理 |
| `electron_layertree_compositing_reasons` | 获取合成原因 |
| `electron_layertree_make_snapshot` | 创建图层快照 |

### DOM Snapshot (DOM 快照)

| 工具 | 描述 |
|------|------|
| `electron_dom_snapshot` | 捕获带样式的完整 DOM 快照 |

## 使用示例

### 连接到 Electron 应用

```
使用 electron_connect 工具，端口 9222
```

### 截取页面截图

```
使用 electron_screenshot 工具，保存到 ./screenshot.png
```

### 点击按钮并输入文本

```
1. electron_click selector="#login-button"
2. electron_type selector="#username" text="admin"
3. electron_press_key key="Enter"
```

### 执行 JavaScript

```
electron_evaluate expression="document.title"
```

### 性能分析

```
1. electron_performance_enable
2. // 执行要分析的操作
3. electron_performance_get_metrics
4. electron_performance_disable
```

### CPU 分析

```
1. electron_profiler_start
2. // 执行要分析的操作
3. electron_profiler_stop
```

### 拦截网络请求

```
1. electron_fetch_enable patterns=[{urlPattern: "*api/*"}]
2. // 请求被拦截时，使用以下工具处理：
3. electron_fetch_fulfill_request requestId="..." responseCode=200 body="..."
```

### 高亮元素进行可视化调试

```
1. electron_overlay_enable
2. electron_overlay_highlight_node selector=".my-element" showInfo=true
3. // 调试完成后
4. electron_overlay_hide_highlight
```

## 调试

启动 Electron 应用后，可以在浏览器访问 `http://localhost:9222/json` 查看可用的调试目标。

## Chrome DevTools Protocol 文档

更多 CDP 协议详情请参考：https://chromedevtools.github.io/devtools-protocol/
