import { ElectronCDPManager } from "./cdp-manager";

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const tools: Tool[] = [
  // Connection tools
  {
    name: "electron_connect",
    description:
      "Connect to an Electron application via Chrome DevTools Protocol. The Electron app must be started with --remote-debugging-port flag.",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "Host address of the Electron app (default: localhost)",
        },
        port: {
          type: "number",
          description: "Debug port of the Electron app (default: 9222)",
        },
        target: {
          type: "string",
          description:
            "Target ID or title to connect to. If not specified, connects to the first page target.",
        },
      },
    },
  },
  {
    name: "electron_disconnect",
    description: "Disconnect from the current Electron application",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_list_targets",
    description: "List all available debugging targets in the Electron application",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_status",
    description: "Get the current connection status and target information",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Navigation tools
  {
    name: "electron_navigate",
    description: "Navigate to a URL in the current window",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "electron_reload",
    description: "Reload the current page",
    inputSchema: {
      type: "object",
      properties: {
        ignoreCache: {
          type: "boolean",
          description: "If true, ignores cache and reloads from server",
        },
      },
    },
  },
  {
    name: "electron_go_back",
    description: "Navigate back in history",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_go_forward",
    description: "Navigate forward in history",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Screenshot tool
  {
    name: "electron_screenshot",
    description: "Capture a screenshot of the current page",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["png", "jpeg", "webp"],
          description: "Image format (default: png)",
        },
        quality: {
          type: "number",
          description: "Image quality for jpeg/webp (0-100)",
        },
        filePath: {
          type: "string",
          description: "Optional file path to save the screenshot to",
        },
      },
    },
  },

  // JavaScript execution tools
  {
    name: "electron_evaluate",
    description: "Execute JavaScript code in the page context and return the result",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "JavaScript expression to evaluate",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "electron_call_function",
    description:
      "Call a JavaScript function with arguments in the page context",
    inputSchema: {
      type: "object",
      properties: {
        functionDeclaration: {
          type: "string",
          description: "JavaScript function declaration (e.g., '(a, b) => a + b')",
        },
        args: {
          type: "array",
          description: "Arguments to pass to the function",
          items: {},
        },
      },
      required: ["functionDeclaration"],
    },
  },

  // DOM tools
  {
    name: "electron_get_document",
    description: "Get the DOM document tree",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_query_selector",
    description: "Find an element using CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_query_selector_all",
    description: "Find all elements matching CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_get_html",
    description: "Get the outer HTML of an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element",
        },
      },
      required: ["selector"],
    },
  },

  // Input tools
  {
    name: "electron_click",
    description: "Click at specific coordinates or on an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click",
        },
        x: {
          type: "number",
          description: "X coordinate (used if selector not provided)",
        },
        y: {
          type: "number",
          description: "Y coordinate (used if selector not provided)",
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button (default: left)",
        },
      },
    },
  },
  {
    name: "electron_type",
    description: "Type text into the focused element or a specific element",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to type",
        },
        selector: {
          type: "string",
          description: "CSS selector for the element to type into (optional)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "electron_press_key",
    description: "Press a keyboard key",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "Key to press (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown')",
        },
        modifiers: {
          type: "number",
          description:
            "Modifier mask (1=Alt, 2=Ctrl, 4=Meta, 8=Shift). Combine with bitwise OR.",
        },
      },
      required: ["key"],
    },
  },

  // Network tools
  {
    name: "electron_get_cookies",
    description: "Get cookies from the browser",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "URLs to get cookies for (optional, gets all if not specified)",
        },
      },
    },
  },
  {
    name: "electron_set_cookie",
    description: "Set a cookie",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Cookie name",
        },
        value: {
          type: "string",
          description: "Cookie value",
        },
        url: {
          type: "string",
          description: "URL for the cookie",
        },
        domain: {
          type: "string",
          description: "Cookie domain",
        },
        path: {
          type: "string",
          description: "Cookie path",
        },
        secure: {
          type: "boolean",
          description: "Is the cookie secure",
        },
        httpOnly: {
          type: "boolean",
          description: "Is the cookie HTTP only",
        },
        sameSite: {
          type: "string",
          enum: ["Strict", "Lax", "None"],
          description: "SameSite attribute",
        },
        expires: {
          type: "number",
          description: "Expiration timestamp (Unix time)",
        },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "electron_clear_cookies",
    description: "Clear all browser cookies",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Emulation tools
  {
    name: "electron_set_viewport",
    description: "Set the viewport size and device scale factor",
    inputSchema: {
      type: "object",
      properties: {
        width: {
          type: "number",
          description: "Viewport width in pixels",
        },
        height: {
          type: "number",
          description: "Viewport height in pixels",
        },
        deviceScaleFactor: {
          type: "number",
          description: "Device scale factor (default: 1)",
        },
        mobile: {
          type: "boolean",
          description: "Whether to emulate a mobile device",
        },
      },
      required: ["width", "height"],
    },
  },
  {
    name: "electron_set_user_agent",
    description: "Set the user agent string",
    inputSchema: {
      type: "object",
      properties: {
        userAgent: {
          type: "string",
          description: "User agent string to set",
        },
      },
      required: ["userAgent"],
    },
  },

  // Wait utilities
  {
    name: "electron_wait_for_selector",
    description: "Wait for an element to appear in the DOM",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to wait for",
        },
        timeout: {
          type: "number",
          description: "Maximum wait time in milliseconds (default: 30000)",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_wait_for_navigation",
    description: "Wait for page navigation to complete",
    inputSchema: {
      type: "object",
      properties: {
        timeout: {
          type: "number",
          description: "Maximum wait time in milliseconds (default: 30000)",
        },
      },
    },
  },
  {
    name: "electron_wait_for_function",
    description: "Wait for a JavaScript function to return a truthy value",
    inputSchema: {
      type: "object",
      properties: {
        function: {
          type: "string",
          description: "JavaScript expression that returns a value",
        },
        timeout: {
          type: "number",
          description: "Maximum wait time in milliseconds (default: 30000)",
        },
        pollInterval: {
          type: "number",
          description: "Polling interval in milliseconds (default: 100)",
        },
      },
      required: ["function"],
    },
  },

  // Page info tools
  {
    name: "electron_get_page_info",
    description: "Get current page URL and title",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_get_page_content",
    description: "Get the full HTML content of the page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Scroll tools
  {
    name: "electron_scroll_to",
    description: "Scroll to specific coordinates",
    inputSchema: {
      type: "object",
      properties: {
        x: {
          type: "number",
          description: "X coordinate to scroll to",
        },
        y: {
          type: "number",
          description: "Y coordinate to scroll to",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "electron_scroll_to_element",
    description: "Scroll an element into view",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to scroll to",
        },
      },
      required: ["selector"],
    },
  },

  // Element interaction tools
  {
    name: "electron_get_bounding_box",
    description: "Get the bounding box (position and size) of an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_focus",
    description: "Focus on an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to focus",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_select_option",
    description: "Select an option in a dropdown/select element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the select element",
        },
        value: {
          type: "string",
          description: "Value of the option to select",
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "electron_set_checked",
    description: "Check or uncheck a checkbox/radio element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the checkbox/radio element",
        },
        checked: {
          type: "boolean",
          description: "Whether to check (true) or uncheck (false)",
        },
      },
      required: ["selector", "checked"],
    },
  },
  {
    name: "electron_clear_input",
    description: "Clear an input field",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input element",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_get_text",
    description: "Get the text content of an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_get_attribute",
    description: "Get an attribute value of an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element",
        },
        attribute: {
          type: "string",
          description: "Name of the attribute to get",
        },
      },
      required: ["selector", "attribute"],
    },
  },
  {
    name: "electron_element_exists",
    description: "Check if an element exists in the DOM",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_is_visible",
    description: "Check if an element is visible",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element",
        },
      },
      required: ["selector"],
    },
  },

  // Advanced input tools
  {
    name: "electron_double_click",
    description: "Double click at coordinates or on an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to double click",
        },
        x: {
          type: "number",
          description: "X coordinate (used if selector not provided)",
        },
        y: {
          type: "number",
          description: "Y coordinate (used if selector not provided)",
        },
      },
    },
  },
  {
    name: "electron_hover",
    description: "Hover over an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to hover over",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "electron_drag_and_drop",
    description: "Drag an element and drop it onto another element",
    inputSchema: {
      type: "object",
      properties: {
        fromSelector: {
          type: "string",
          description: "CSS selector of the element to drag",
        },
        toSelector: {
          type: "string",
          description: "CSS selector of the drop target",
        },
      },
      required: ["fromSelector", "toSelector"],
    },
  },

  // PDF tool
  {
    name: "electron_print_to_pdf",
    description: "Generate a PDF of the current page",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File path to save the PDF (optional, returns base64 if not provided)",
        },
        landscape: {
          type: "boolean",
          description: "Use landscape orientation",
        },
        printBackground: {
          type: "boolean",
          description: "Print background graphics",
        },
        scale: {
          type: "number",
          description: "Scale of the PDF (0.1 to 2.0)",
        },
      },
    },
  },

  // Raw CDP command
  {
    name: "electron_execute_cdp",
    description: "Execute a raw CDP command. Use for advanced operations not covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "CDP domain (e.g., 'Page', 'Runtime', 'Network')",
        },
        method: {
          type: "string",
          description: "Method name within the domain",
        },
        params: {
          type: "object",
          description: "Parameters for the CDP command",
        },
      },
      required: ["domain", "method"],
    },
  },

  // ===== Accessibility Domain =====
  {
    name: "electron_accessibility_get_tree",
    description: "Get the full accessibility tree of the page",
    inputSchema: {
      type: "object",
      properties: {
        depth: {
          type: "number",
          description: "Maximum depth of the accessibility tree (optional)",
        },
        frameId: {
          type: "string",
          description: "Frame ID to get the tree from (optional)",
        },
      },
    },
  },
  {
    name: "electron_accessibility_query",
    description: "Query accessible nodes by name or role",
    inputSchema: {
      type: "object",
      properties: {
        accessibleName: {
          type: "string",
          description: "Accessible name to search for",
        },
        role: {
          type: "string",
          description: "Role to search for",
        },
      },
    },
  },

  // ===== Performance Domain =====
  {
    name: "electron_performance_enable",
    description: "Enable performance metrics collection",
    inputSchema: {
      type: "object",
      properties: {
        timeDomain: {
          type: "string",
          enum: ["timeTicks", "threadTicks"],
          description: "Time domain to use for metrics",
        },
      },
    },
  },
  {
    name: "electron_performance_get_metrics",
    description: "Get collected performance metrics",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_performance_disable",
    description: "Disable performance metrics collection",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Profiler Domain =====
  {
    name: "electron_profiler_start",
    description: "Start CPU profiling",
    inputSchema: {
      type: "object",
      properties: {
        samplingInterval: {
          type: "number",
          description: "Sampling interval in microseconds (default: 1000)",
        },
      },
    },
  },
  {
    name: "electron_profiler_stop",
    description: "Stop CPU profiling and get the profile",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_profiler_coverage_start",
    description: "Start collecting code coverage",
    inputSchema: {
      type: "object",
      properties: {
        callCount: {
          type: "boolean",
          description: "Collect call counts",
        },
        detailed: {
          type: "boolean",
          description: "Collect detailed coverage",
        },
        allowTriggeredUpdates: {
          type: "boolean",
          description: "Allow triggered updates during coverage collection",
        },
      },
    },
  },
  {
    name: "electron_profiler_coverage_stop",
    description: "Stop collecting code coverage and get results",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_profiler_coverage_best_effort",
    description: "Get best-effort code coverage without affecting execution",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Heap Profiler Domain =====
  {
    name: "electron_heap_snapshot",
    description: "Take a heap snapshot",
    inputSchema: {
      type: "object",
      properties: {
        reportProgress: {
          type: "boolean",
          description: "Report progress while taking snapshot",
        },
        treatGlobalObjectsAsRoots: {
          type: "boolean",
          description: "Treat global objects as roots",
        },
        captureNumericValue: {
          type: "boolean",
          description: "Capture numeric values",
        },
      },
    },
  },
  {
    name: "electron_heap_enable",
    description: "Enable heap profiler",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_heap_disable",
    description: "Disable heap profiler",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_heap_gc",
    description: "Force garbage collection",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_heap_sampling_start",
    description: "Start heap sampling profiler",
    inputSchema: {
      type: "object",
      properties: {
        samplingInterval: {
          type: "number",
          description: "Average sample interval in bytes (default: 32768)",
        },
        includeObjectsCollectedByMajorGC: {
          type: "boolean",
          description: "Include objects collected by major GC",
        },
        includeObjectsCollectedByMinorGC: {
          type: "boolean",
          description: "Include objects collected by minor GC",
        },
      },
    },
  },
  {
    name: "electron_heap_sampling_stop",
    description: "Stop heap sampling profiler and get the profile",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Debugger Domain =====
  {
    name: "electron_debugger_enable",
    description: "Enable debugger for the page",
    inputSchema: {
      type: "object",
      properties: {
        maxScriptsCacheSize: {
          type: "number",
          description: "Maximum scripts cache size",
        },
      },
    },
  },
  {
    name: "electron_debugger_disable",
    description: "Disable debugger",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_debugger_set_breakpoint",
    description: "Set a breakpoint at a specific location",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Script URL pattern",
        },
        urlRegex: {
          type: "string",
          description: "Script URL regex pattern",
        },
        scriptHash: {
          type: "string",
          description: "Script hash to match",
        },
        lineNumber: {
          type: "number",
          description: "Line number (0-based)",
        },
        columnNumber: {
          type: "number",
          description: "Column number (0-based)",
        },
        condition: {
          type: "string",
          description: "Breakpoint condition expression",
        },
      },
      required: ["lineNumber"],
    },
  },
  {
    name: "electron_debugger_remove_breakpoint",
    description: "Remove a breakpoint",
    inputSchema: {
      type: "object",
      properties: {
        breakpointId: {
          type: "string",
          description: "Breakpoint ID to remove",
        },
      },
      required: ["breakpointId"],
    },
  },
  {
    name: "electron_debugger_pause",
    description: "Pause JavaScript execution",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_debugger_resume",
    description: "Resume JavaScript execution",
    inputSchema: {
      type: "object",
      properties: {
        terminateOnResume: {
          type: "boolean",
          description: "Terminate the script on resume",
        },
      },
    },
  },
  {
    name: "electron_debugger_step_over",
    description: "Step over next statement",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_debugger_step_into",
    description: "Step into next statement",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_debugger_step_out",
    description: "Step out of current function",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== CSS Domain =====
  {
    name: "electron_css_enable",
    description: "Enable CSS agent for the page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_css_disable",
    description: "Disable CSS agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_css_get_computed_style",
    description: "Get computed style for a node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Node ID",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "electron_css_get_inline_styles",
    description: "Get inline styles for a node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Node ID",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "electron_css_get_matched_styles",
    description: "Get matched CSS rules for a node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Node ID",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "electron_css_coverage_start",
    description: "Start CSS coverage tracking",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_css_coverage_stop",
    description: "Stop CSS coverage tracking and get results",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Tracing Domain =====
  {
    name: "electron_tracing_start",
    description: "Start trace events collection",
    inputSchema: {
      type: "object",
      properties: {
        categories: {
          type: "string",
          description: "Categories to trace (comma-separated)",
        },
        traceConfig: {
          type: "object",
          description: "Trace configuration object",
        },
        bufferUsageReportingInterval: {
          type: "number",
          description: "Buffer usage reporting interval in milliseconds",
        },
        transferMode: {
          type: "string",
          enum: ["ReportEvents", "ReturnAsStream"],
          description: "Transfer mode for trace data",
        },
      },
    },
  },
  {
    name: "electron_tracing_stop",
    description: "Stop trace events collection",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_tracing_get_categories",
    description: "Get available tracing categories",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Storage Domain =====
  {
    name: "electron_storage_clear",
    description: "Clear storage for origin",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Security origin to clear storage for",
        },
        storageTypes: {
          type: "string",
          description: "Storage types to clear (comma-separated: cookies, local_storage, indexeddb, etc.)",
        },
      },
      required: ["origin", "storageTypes"],
    },
  },
  {
    name: "electron_storage_get_usage",
    description: "Get storage usage and quota",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Security origin",
        },
      },
      required: ["origin"],
    },
  },

  // ===== IndexedDB Domain =====
  {
    name: "electron_indexeddb_enable",
    description: "Enable IndexedDB agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_indexeddb_disable",
    description: "Disable IndexedDB agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_indexeddb_list_databases",
    description: "List IndexedDB databases for an origin",
    inputSchema: {
      type: "object",
      properties: {
        securityOrigin: {
          type: "string",
          description: "Security origin",
        },
        storageKey: {
          type: "string",
          description: "Storage key",
        },
      },
    },
  },
  {
    name: "electron_indexeddb_request_data",
    description: "Request data from an IndexedDB object store",
    inputSchema: {
      type: "object",
      properties: {
        securityOrigin: {
          type: "string",
          description: "Security origin",
        },
        storageKey: {
          type: "string",
          description: "Storage key",
        },
        databaseName: {
          type: "string",
          description: "Database name",
        },
        objectStoreName: {
          type: "string",
          description: "Object store name",
        },
        indexName: {
          type: "string",
          description: "Index name (empty string for primary key)",
        },
        skipCount: {
          type: "number",
          description: "Number of entries to skip",
        },
        pageSize: {
          type: "number",
          description: "Number of entries to return",
        },
      },
      required: ["databaseName", "objectStoreName", "indexName", "skipCount", "pageSize"],
    },
  },
  {
    name: "electron_indexeddb_delete_database",
    description: "Delete an IndexedDB database",
    inputSchema: {
      type: "object",
      properties: {
        securityOrigin: {
          type: "string",
          description: "Security origin",
        },
        storageKey: {
          type: "string",
          description: "Storage key",
        },
        databaseName: {
          type: "string",
          description: "Database name",
        },
      },
      required: ["databaseName"],
    },
  },

  // ===== ServiceWorker Domain =====
  {
    name: "electron_serviceworker_enable",
    description: "Enable ServiceWorker agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_serviceworker_disable",
    description: "Disable ServiceWorker agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_serviceworker_unregister",
    description: "Unregister a service worker",
    inputSchema: {
      type: "object",
      properties: {
        scopeURL: {
          type: "string",
          description: "Scope URL of the service worker to unregister",
        },
      },
      required: ["scopeURL"],
    },
  },
  {
    name: "electron_serviceworker_update",
    description: "Update a service worker registration",
    inputSchema: {
      type: "object",
      properties: {
        scopeURL: {
          type: "string",
          description: "Scope URL of the service worker to update",
        },
      },
      required: ["scopeURL"],
    },
  },
  {
    name: "electron_serviceworker_stop",
    description: "Stop a service worker",
    inputSchema: {
      type: "object",
      properties: {
        versionId: {
          type: "string",
          description: "Version ID of the service worker to stop",
        },
      },
      required: ["versionId"],
    },
  },

  // ===== Target Domain =====
  {
    name: "electron_target_get_targets",
    description: "Get all targets (pages, workers, etc.)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_target_create",
    description: "Create a new target (page)",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to open in the new target",
        },
        width: {
          type: "number",
          description: "Window width",
        },
        height: {
          type: "number",
          description: "Window height",
        },
        newWindow: {
          type: "boolean",
          description: "Open in a new window",
        },
        background: {
          type: "boolean",
          description: "Open in background",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "electron_target_close",
    description: "Close a target",
    inputSchema: {
      type: "object",
      properties: {
        targetId: {
          type: "string",
          description: "Target ID to close",
        },
      },
      required: ["targetId"],
    },
  },
  {
    name: "electron_target_activate",
    description: "Activate (focus) a target",
    inputSchema: {
      type: "object",
      properties: {
        targetId: {
          type: "string",
          description: "Target ID to activate",
        },
      },
      required: ["targetId"],
    },
  },

  // ===== Browser Domain =====
  {
    name: "electron_browser_version",
    description: "Get browser version information",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_browser_get_window_bounds",
    description: "Get browser window bounds",
    inputSchema: {
      type: "object",
      properties: {
        windowId: {
          type: "number",
          description: "Window ID",
        },
      },
      required: ["windowId"],
    },
  },
  {
    name: "electron_browser_set_window_bounds",
    description: "Set browser window bounds",
    inputSchema: {
      type: "object",
      properties: {
        windowId: {
          type: "number",
          description: "Window ID",
        },
        left: {
          type: "number",
          description: "Window left position",
        },
        top: {
          type: "number",
          description: "Window top position",
        },
        width: {
          type: "number",
          description: "Window width",
        },
        height: {
          type: "number",
          description: "Window height",
        },
        windowState: {
          type: "string",
          enum: ["normal", "minimized", "maximized", "fullscreen"],
          description: "Window state",
        },
      },
      required: ["windowId"],
    },
  },
  {
    name: "electron_browser_set_download_behavior",
    description: "Set download behavior",
    inputSchema: {
      type: "object",
      properties: {
        behavior: {
          type: "string",
          enum: ["deny", "allow", "allowAndName", "default"],
          description: "Download behavior",
        },
        downloadPath: {
          type: "string",
          description: "Path to save downloads to",
        },
      },
      required: ["behavior"],
    },
  },

  // ===== System Info Domain =====
  {
    name: "electron_system_info",
    description: "Get system information (GPU, model, etc.)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_process_info",
    description: "Get information about running processes",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Memory Domain =====
  {
    name: "electron_memory_get_dom_counters",
    description: "Get DOM counters (documents, nodes, listeners)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_memory_force_gc",
    description: "Force garbage collection",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_memory_sampling_start",
    description: "Start memory sampling",
    inputSchema: {
      type: "object",
      properties: {
        samplingInterval: {
          type: "number",
          description: "Sampling interval in bytes",
        },
        suppressRandomness: {
          type: "boolean",
          description: "Suppress randomness in sampling",
        },
      },
    },
  },
  {
    name: "electron_memory_sampling_stop",
    description: "Stop memory sampling",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_memory_get_sampling_profile",
    description: "Get memory sampling profile",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Security Domain =====
  {
    name: "electron_security_enable",
    description: "Enable security domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_security_disable",
    description: "Disable security domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_security_ignore_certificate_errors",
    description: "Ignore certificate errors",
    inputSchema: {
      type: "object",
      properties: {
        ignore: {
          type: "boolean",
          description: "Whether to ignore certificate errors",
        },
      },
      required: ["ignore"],
    },
  },

  // ===== Overlay Domain =====
  {
    name: "electron_overlay_enable",
    description: "Enable overlay domain for visual debugging",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_overlay_disable",
    description: "Disable overlay domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_overlay_highlight_node",
    description: "Highlight a DOM node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Node ID to highlight",
        },
        selector: {
          type: "string",
          description: "CSS selector (alternative to nodeId)",
        },
        showInfo: {
          type: "boolean",
          description: "Show element info overlay",
        },
        showStyles: {
          type: "boolean",
          description: "Show style info",
        },
        showRulers: {
          type: "boolean",
          description: "Show rulers",
        },
        contentColor: {
          type: "object",
          properties: {
            r: { type: "number" },
            g: { type: "number" },
            b: { type: "number" },
            a: { type: "number" },
          },
          description: "Content highlight color (RGBA)",
        },
        paddingColor: {
          type: "object",
          properties: {
            r: { type: "number" },
            g: { type: "number" },
            b: { type: "number" },
            a: { type: "number" },
          },
          description: "Padding highlight color (RGBA)",
        },
        borderColor: {
          type: "object",
          properties: {
            r: { type: "number" },
            g: { type: "number" },
            b: { type: "number" },
            a: { type: "number" },
          },
          description: "Border highlight color (RGBA)",
        },
        marginColor: {
          type: "object",
          properties: {
            r: { type: "number" },
            g: { type: "number" },
            b: { type: "number" },
            a: { type: "number" },
          },
          description: "Margin highlight color (RGBA)",
        },
      },
    },
  },
  {
    name: "electron_overlay_hide_highlight",
    description: "Hide all highlights",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_overlay_set_inspect_mode",
    description: "Enable inspect mode (element picker)",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["searchForNode", "searchForUAShadowDOM", "captureAreaScreenshot", "showDistances", "none"],
          description: "Inspect mode",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "electron_overlay_show_fps_counter",
    description: "Show FPS counter",
    inputSchema: {
      type: "object",
      properties: {
        show: {
          type: "boolean",
          description: "Whether to show FPS counter",
        },
      },
      required: ["show"],
    },
  },
  {
    name: "electron_overlay_show_paint_rects",
    description: "Show paint rectangles",
    inputSchema: {
      type: "object",
      properties: {
        result: {
          type: "boolean",
          description: "Whether to show paint rectangles",
        },
      },
      required: ["result"],
    },
  },

  // ===== Log Domain =====
  {
    name: "electron_log_enable",
    description: "Enable log domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_log_disable",
    description: "Disable log domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_log_clear",
    description: "Clear log entries",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_log_start_violations",
    description: "Start violation reporting",
    inputSchema: {
      type: "object",
      properties: {
        config: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                enum: ["longTask", "longLayout", "blockedEvent", "blockedParser", "discouragedAPIUse", "handler", "recurringHandler"],
              },
              threshold: { type: "number" },
            },
          },
          description: "Violation settings array",
        },
      },
      required: ["config"],
    },
  },
  {
    name: "electron_log_stop_violations",
    description: "Stop violation reporting",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== Fetch Domain (Request Interception) =====
  {
    name: "electron_fetch_enable",
    description: "Enable request interception",
    inputSchema: {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              urlPattern: { type: "string" },
              resourceType: { type: "string" },
              requestStage: { type: "string", enum: ["Request", "Response"] },
            },
          },
          description: "Request patterns to intercept",
        },
        handleAuthRequests: {
          type: "boolean",
          description: "Handle auth requests",
        },
      },
    },
  },
  {
    name: "electron_fetch_disable",
    description: "Disable request interception",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_fetch_continue_request",
    description: "Continue an intercepted request (optionally modified)",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Request ID",
        },
        url: {
          type: "string",
          description: "Modified URL",
        },
        method: {
          type: "string",
          description: "Modified method",
        },
        postData: {
          type: "string",
          description: "Modified post data",
        },
        headers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Modified headers",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "electron_fetch_fail_request",
    description: "Fail an intercepted request",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Request ID",
        },
        errorReason: {
          type: "string",
          description: "Error reason (e.g., 'Failed', 'Aborted', 'TimedOut')",
        },
      },
      required: ["requestId", "errorReason"],
    },
  },
  {
    name: "electron_fetch_fulfill_request",
    description: "Fulfill an intercepted request with a custom response",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Request ID",
        },
        responseCode: {
          type: "number",
          description: "HTTP status code",
        },
        responseHeaders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Response headers",
        },
        body: {
          type: "string",
          description: "Response body (base64 encoded if binary)",
        },
      },
      required: ["requestId", "responseCode"],
    },
  },

  // ===== Animation Domain =====
  {
    name: "electron_animation_enable",
    description: "Enable animation agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_animation_disable",
    description: "Disable animation agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_animation_set_playback_rate",
    description: "Set global playback rate for animations",
    inputSchema: {
      type: "object",
      properties: {
        playbackRate: {
          type: "number",
          description: "Playback rate (1.0 = normal speed)",
        },
      },
      required: ["playbackRate"],
    },
  },
  {
    name: "electron_animation_get_playback_rate",
    description: "Get current global playback rate",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_animation_seek",
    description: "Seek animations to a specific time",
    inputSchema: {
      type: "object",
      properties: {
        animations: {
          type: "array",
          items: { type: "string" },
          description: "Animation IDs to seek",
        },
        currentTime: {
          type: "number",
          description: "Time to seek to in milliseconds",
        },
      },
      required: ["animations", "currentTime"],
    },
  },
  {
    name: "electron_animation_pause",
    description: "Pause animations",
    inputSchema: {
      type: "object",
      properties: {
        animations: {
          type: "array",
          items: { type: "string" },
          description: "Animation IDs to pause",
        },
      },
      required: ["animations"],
    },
  },
  {
    name: "electron_animation_release",
    description: "Release animations",
    inputSchema: {
      type: "object",
      properties: {
        animations: {
          type: "array",
          items: { type: "string" },
          description: "Animation IDs to release",
        },
      },
      required: ["animations"],
    },
  },

  // ===== Audits Domain =====
  {
    name: "electron_audits_enable",
    description: "Enable audits domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_audits_disable",
    description: "Disable audits domain",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_audits_check_contrast",
    description: "Run contrast check",
    inputSchema: {
      type: "object",
      properties: {
        reportAAA: {
          type: "boolean",
          description: "Report AAA level violations",
        },
      },
    },
  },
  {
    name: "electron_audits_check_forms",
    description: "Check for form issues",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ===== LayerTree Domain =====
  {
    name: "electron_layertree_enable",
    description: "Enable layer tree compositing agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_layertree_disable",
    description: "Disable layer tree compositing agent",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "electron_layertree_compositing_reasons",
    description: "Get compositing reasons for a layer",
    inputSchema: {
      type: "object",
      properties: {
        layerId: {
          type: "string",
          description: "Layer ID",
        },
      },
      required: ["layerId"],
    },
  },
  {
    name: "electron_layertree_make_snapshot",
    description: "Make a snapshot of a layer",
    inputSchema: {
      type: "object",
      properties: {
        layerId: {
          type: "string",
          description: "Layer ID",
        },
      },
      required: ["layerId"],
    },
  },

  // ===== DOM Snapshot Domain =====
  {
    name: "electron_dom_snapshot",
    description: "Capture full DOM snapshot with styles",
    inputSchema: {
      type: "object",
      properties: {
        computedStyles: {
          type: "array",
          items: { type: "string" },
          description: "CSS properties to capture",
        },
        includePaintOrder: {
          type: "boolean",
          description: "Include paint order info",
        },
        includeDOMRects: {
          type: "boolean",
          description: "Include DOM rectangles",
        },
        includeBlendedBackgroundColors: {
          type: "boolean",
          description: "Include blended background colors",
        },
        includeTextColorOpacities: {
          type: "boolean",
          description: "Include text color opacities",
        },
      },
    },
  },
];

export async function handleToolCall(
  manager: ElectronCDPManager,
  name: string,
  args: Record<string, any>
): Promise<any> {
  switch (name) {
    // Connection tools
    case "electron_connect":
      return manager.connect({
        host: args.host,
        port: args.port,
        target: args.target,
      });

    case "electron_disconnect":
      return manager.disconnect();

    case "electron_list_targets":
      return manager.listTargets();

    case "electron_status":
      return {
        connected: manager.isConnected(),
        target: manager.getCurrentTarget(),
      };

    // Navigation tools
    case "electron_navigate":
      return manager.navigate(args.url);

    case "electron_reload":
      return manager.reload(args.ignoreCache || false);

    case "electron_go_back":
      return manager.goBack();

    case "electron_go_forward":
      return manager.goForward();

    // Screenshot
    case "electron_screenshot": {
      const data = await manager.captureScreenshot(
        args.format || "png",
        args.quality
      );
      if (args.filePath) {
        const fs = await import("fs/promises");
        await fs.writeFile(args.filePath, Buffer.from(data, "base64"));
        return { saved: args.filePath };
      }
      return { data, format: args.format || "png" };
    }

    // JavaScript execution
    case "electron_evaluate":
      return manager.evaluate(args.expression);

    case "electron_call_function":
      return manager.callFunction(args.functionDeclaration, args.args || []);

    // DOM tools
    case "electron_get_document":
      return manager.getDocument();

    case "electron_query_selector": {
      const nodeId = await manager.querySelector(args.selector);
      return { nodeId, found: nodeId !== null };
    }

    case "electron_query_selector_all": {
      const nodeIds = await manager.querySelectorAll(args.selector);
      return { nodeIds, count: nodeIds.length };
    }

    case "electron_get_html": {
      const nodeId = await manager.querySelector(args.selector);
      if (!nodeId) {
        throw new Error(`Element not found: ${args.selector}`);
      }
      const html = await manager.getOuterHTML(nodeId);
      return { html };
    }

    // Input tools
    case "electron_click":
      if (args.selector) {
        await manager.clickElement(args.selector);
      } else if (typeof args.x === "number" && typeof args.y === "number") {
        await manager.click(args.x, args.y, args.button || "left");
      } else {
        throw new Error(
          "Either selector or x/y coordinates must be provided"
        );
      }
      return { clicked: true };

    case "electron_type":
      if (args.selector) {
        await manager.typeInElement(args.selector, args.text);
      } else {
        await manager.type(args.text);
      }
      return { typed: args.text };

    case "electron_press_key":
      await manager.pressKey(args.key, args.modifiers || 0);
      return { pressed: args.key };

    // Network tools
    case "electron_get_cookies":
      return manager.getCookies(args.urls);

    case "electron_set_cookie":
      await manager.setCookie(args.name, args.value, {
        url: args.url,
        domain: args.domain,
        path: args.path,
        secure: args.secure,
        httpOnly: args.httpOnly,
        sameSite: args.sameSite,
        expires: args.expires,
      });
      return { set: true };

    case "electron_clear_cookies":
      await manager.clearBrowserCookies();
      return { cleared: true };

    // Emulation tools
    case "electron_set_viewport":
      await manager.setDeviceMetrics(
        args.width,
        args.height,
        args.deviceScaleFactor || 1,
        args.mobile || false
      );
      return { set: true };

    case "electron_set_user_agent":
      await manager.setUserAgent(args.userAgent);
      return { set: true };

    // Wait utilities
    case "electron_wait_for_selector":
      await manager.waitForSelector(args.selector, args.timeout || 30000);
      return { found: true };

    case "electron_wait_for_navigation":
      await manager.waitForNavigation(args.timeout || 30000);
      return { navigated: true };

    case "electron_wait_for_function":
      return manager.waitForFunction(
        args.function,
        args.timeout || 30000,
        args.pollInterval || 100
      );

    // Page info tools
    case "electron_get_page_info":
      return manager.getPageInfo();

    case "electron_get_page_content":
      return { content: await manager.getPageContent() };

    // Scroll tools
    case "electron_scroll_to":
      await manager.scrollTo(args.x, args.y);
      return { scrolled: true };

    case "electron_scroll_to_element":
      await manager.scrollToElement(args.selector);
      return { scrolled: true };

    // Element interaction tools
    case "electron_get_bounding_box":
      return manager.getBoundingBox(args.selector);

    case "electron_focus":
      await manager.focusElement(args.selector);
      return { focused: true };

    case "electron_select_option":
      await manager.selectOption(args.selector, args.value);
      return { selected: true };

    case "electron_set_checked":
      await manager.setChecked(args.selector, args.checked);
      return { set: true };

    case "electron_clear_input":
      await manager.clearInput(args.selector);
      return { cleared: true };

    case "electron_get_text":
      return { text: await manager.getTextContent(args.selector) };

    case "electron_get_attribute":
      return { value: await manager.getAttribute(args.selector, args.attribute) };

    case "electron_element_exists":
      return { exists: await manager.elementExists(args.selector) };

    case "electron_is_visible":
      return { visible: await manager.isVisible(args.selector) };

    // Advanced input tools
    case "electron_double_click":
      if (args.selector) {
        await manager.doubleClickElement(args.selector);
      } else if (typeof args.x === "number" && typeof args.y === "number") {
        await manager.doubleClick(args.x, args.y);
      } else {
        throw new Error(
          "Either selector or x/y coordinates must be provided"
        );
      }
      return { doubleClicked: true };

    case "electron_hover":
      await manager.hover(args.selector);
      return { hovered: true };

    case "electron_drag_and_drop":
      await manager.dragAndDrop(args.fromSelector, args.toSelector);
      return { dropped: true };

    // PDF tool
    case "electron_print_to_pdf": {
      const pdfData = await manager.printToPDF({
        landscape: args.landscape,
        printBackground: args.printBackground,
        scale: args.scale,
      });
      if (args.filePath) {
        const fs = await import("fs/promises");
        await fs.writeFile(args.filePath, Buffer.from(pdfData, "base64"));
        return { saved: args.filePath };
      }
      return { data: pdfData };
    }

    // Raw CDP command
    case "electron_execute_cdp":
      return manager.executeCDPCommand(args.domain, args.method, args.params || {});

    // ===== Accessibility Domain =====
    case "electron_accessibility_get_tree":
      return manager.accessibility.getFullAXTree({
        depth: args.depth,
        frameId: args.frameId,
      });

    case "electron_accessibility_query":
      return manager.accessibility.queryAXTree({
        accessibleName: args.accessibleName,
        role: args.role,
      });

    // ===== Performance Domain =====
    case "electron_performance_enable":
      await manager.performance.enable(args.timeDomain);
      return { enabled: true };

    case "electron_performance_get_metrics":
      return manager.performance.getMetrics();

    case "electron_performance_disable":
      await manager.performance.disable();
      return { disabled: true };

    // ===== Profiler Domain =====
    case "electron_profiler_start":
      await manager.profiler.enable();
      await manager.profiler.start();
      return { started: true };

    case "electron_profiler_stop":
      return manager.profiler.stop();

    case "electron_profiler_coverage_start":
      await manager.profiler.startPreciseCoverage({
        callCount: args.callCount,
        detailed: args.detailed,
        allowTriggeredUpdates: args.allowTriggeredUpdates,
      });
      return { started: true };

    case "electron_profiler_coverage_stop":
      return manager.profiler.stopPreciseCoverage();

    case "electron_profiler_coverage_best_effort":
      return manager.profiler.getBestEffortCoverage();

    // ===== Heap Profiler Domain =====
    case "electron_heap_snapshot":
      await manager.heapProfiler.takeHeapSnapshot({
        reportProgress: args.reportProgress,
        treatGlobalObjectsAsRoots: args.treatGlobalObjectsAsRoots,
        captureNumericValue: args.captureNumericValue,
      });
      return { taken: true };

    case "electron_heap_enable":
      await manager.heapProfiler.enable();
      return { enabled: true };

    case "electron_heap_disable":
      await manager.heapProfiler.disable();
      return { disabled: true };

    case "electron_heap_gc":
      await manager.heapProfiler.collectGarbage();
      return { collected: true };

    case "electron_heap_sampling_start":
      await manager.heapProfiler.startSampling({
        samplingInterval: args.samplingInterval,
        includeObjectsCollectedByMajorGC: args.includeObjectsCollectedByMajorGC,
        includeObjectsCollectedByMinorGC: args.includeObjectsCollectedByMinorGC,
      });
      return { started: true };

    case "electron_heap_sampling_stop":
      return manager.heapProfiler.stopSampling();

    // ===== Debugger Domain =====
    case "electron_debugger_enable":
      return manager.debugger.enable({
        maxScriptsCacheSize: args.maxScriptsCacheSize,
      });

    case "electron_debugger_disable":
      await manager.debugger.disable();
      return { disabled: true };

    case "electron_debugger_set_breakpoint":
      return manager.debugger.setBreakpointByUrl({
        url: args.url,
        urlRegex: args.urlRegex,
        scriptHash: args.scriptHash,
        lineNumber: args.lineNumber,
        columnNumber: args.columnNumber,
        condition: args.condition,
      });

    case "electron_debugger_remove_breakpoint":
      await manager.debugger.removeBreakpoint(args.breakpointId);
      return { removed: true };

    case "electron_debugger_pause":
      await manager.debugger.pause();
      return { paused: true };

    case "electron_debugger_resume":
      await manager.debugger.resume(args.terminateOnResume);
      return { resumed: true };

    case "electron_debugger_step_over":
      await manager.debugger.stepOver();
      return { stepped: true };

    case "electron_debugger_step_into":
      await manager.debugger.stepInto();
      return { stepped: true };

    case "electron_debugger_step_out":
      await manager.debugger.stepOut();
      return { stepped: true };

    // ===== CSS Domain =====
    case "electron_css_enable":
      await manager.css.enable();
      return { enabled: true };

    case "electron_css_disable":
      await manager.css.disable();
      return { disabled: true };

    case "electron_css_get_computed_style":
      return manager.css.getComputedStyleForNode(args.nodeId);

    case "electron_css_get_inline_styles":
      return manager.css.getInlineStylesForNode(args.nodeId);

    case "electron_css_get_matched_styles":
      return manager.css.getMatchedStylesForNode(args.nodeId);

    case "electron_css_coverage_start":
      await manager.css.startRuleUsageTracking();
      return { started: true };

    case "electron_css_coverage_stop":
      return manager.css.stopRuleUsageTracking();

    // ===== Tracing Domain =====
    case "electron_tracing_start":
      await manager.tracing.start({
        categories: args.categories,
        traceConfig: args.traceConfig,
        bufferUsageReportingInterval: args.bufferUsageReportingInterval,
        transferMode: args.transferMode,
      });
      return { started: true };

    case "electron_tracing_stop":
      await manager.tracing.end();
      return { stopped: true };

    case "electron_tracing_get_categories":
      return manager.tracing.getCategories();

    // ===== Storage Domain =====
    case "electron_storage_clear":
      await manager.storage.clearDataForOrigin(args.origin, args.storageTypes);
      return { cleared: true };

    case "electron_storage_get_usage":
      return manager.storage.getUsageAndQuota(args.origin);

    // ===== IndexedDB Domain =====
    case "electron_indexeddb_enable":
      await manager.indexedDB.enable();
      return { enabled: true };

    case "electron_indexeddb_disable":
      await manager.indexedDB.disable();
      return { disabled: true };

    case "electron_indexeddb_list_databases":
      return manager.indexedDB.requestDatabaseNames({
        securityOrigin: args.securityOrigin,
        storageKey: args.storageKey,
      });

    case "electron_indexeddb_request_data":
      return manager.indexedDB.requestData({
        securityOrigin: args.securityOrigin,
        storageKey: args.storageKey,
        databaseName: args.databaseName,
        objectStoreName: args.objectStoreName,
        indexName: args.indexName,
        skipCount: args.skipCount,
        pageSize: args.pageSize,
      });

    case "electron_indexeddb_delete_database":
      await manager.indexedDB.deleteDatabase({
        securityOrigin: args.securityOrigin,
        storageKey: args.storageKey,
        databaseName: args.databaseName,
      });
      return { deleted: true };

    // ===== ServiceWorker Domain =====
    case "electron_serviceworker_enable":
      await manager.serviceWorker.enable();
      return { enabled: true };

    case "electron_serviceworker_disable":
      await manager.serviceWorker.disable();
      return { disabled: true };

    case "electron_serviceworker_unregister":
      await manager.serviceWorker.unregister(args.scopeURL);
      return { unregistered: true };

    case "electron_serviceworker_update":
      await manager.serviceWorker.updateRegistration(args.scopeURL);
      return { updated: true };

    case "electron_serviceworker_stop":
      await manager.serviceWorker.stopWorker(args.versionId);
      return { stopped: true };

    // ===== Target Domain =====
    case "electron_target_get_targets":
      return manager.target.getTargets();

    case "electron_target_create":
      return manager.target.createTarget({
        url: args.url,
        width: args.width,
        height: args.height,
        newWindow: args.newWindow,
        background: args.background,
      });

    case "electron_target_close":
      return manager.target.closeTarget(args.targetId);

    case "electron_target_activate":
      await manager.target.activateTarget(args.targetId);
      return { activated: true };

    // ===== Browser Domain =====
    case "electron_browser_version":
      return manager.browser.getVersion();

    case "electron_browser_get_window_bounds":
      return manager.browser.getWindowBounds(args.windowId);

    case "electron_browser_set_window_bounds":
      await manager.browser.setWindowBounds(args.windowId, {
        left: args.left,
        top: args.top,
        width: args.width,
        height: args.height,
        windowState: args.windowState,
      });
      return { set: true };

    case "electron_browser_set_download_behavior":
      await manager.browser.setDownloadBehavior({
        behavior: args.behavior,
        downloadPath: args.downloadPath,
      });
      return { set: true };

    // ===== System Info Domain =====
    case "electron_system_info":
      return manager.systemInfo.getInfo();

    case "electron_process_info":
      return manager.systemInfo.getProcessInfo();

    // ===== Memory Domain =====
    case "electron_memory_get_dom_counters":
      return manager.memory.getDOMCounters();

    case "electron_memory_force_gc":
      await manager.memory.forciblyPurgeJavaScriptMemory();
      return { collected: true };

    case "electron_memory_sampling_start":
      await manager.memory.startSampling({
        samplingInterval: args.samplingInterval,
        suppressRandomness: args.suppressRandomness,
      });
      return { started: true };

    case "electron_memory_sampling_stop":
      await manager.memory.stopSampling();
      return { stopped: true };

    case "electron_memory_get_sampling_profile":
      return manager.memory.getSamplingProfile();

    // ===== Security Domain =====
    case "electron_security_enable":
      await manager.security.enable();
      return { enabled: true };

    case "electron_security_disable":
      await manager.security.disable();
      return { disabled: true };

    case "electron_security_ignore_certificate_errors":
      await manager.security.setIgnoreCertificateErrors(args.ignore);
      return { set: true };

    // ===== Overlay Domain =====
    case "electron_overlay_enable":
      await manager.overlay.enable();
      return { enabled: true };

    case "electron_overlay_disable":
      await manager.overlay.disable();
      return { disabled: true };

    case "electron_overlay_highlight_node": {
      let nodeId = args.nodeId;
      if (!nodeId && args.selector) {
        nodeId = await manager.querySelector(args.selector);
        if (!nodeId) {
          throw new Error(`Element not found: ${args.selector}`);
        }
      }
      await manager.overlay.highlightNode({
        nodeId,
        highlightConfig: {
          showInfo: args.showInfo,
          showStyles: args.showStyles,
          showRulers: args.showRulers,
          contentColor: args.contentColor,
          paddingColor: args.paddingColor,
          borderColor: args.borderColor,
          marginColor: args.marginColor,
        },
      });
      return { highlighted: true };
    }

    case "electron_overlay_hide_highlight":
      await manager.overlay.hideHighlight();
      return { hidden: true };

    case "electron_overlay_set_inspect_mode":
      await manager.overlay.setInspectMode(args.mode);
      return { set: true };

    case "electron_overlay_show_fps_counter":
      await manager.overlay.setShowFPSCounter(args.show);
      return { set: true };

    case "electron_overlay_show_paint_rects":
      await manager.overlay.setShowPaintRects(args.result);
      return { set: true };

    // ===== Log Domain =====
    case "electron_log_enable":
      await manager.log.enable();
      return { enabled: true };

    case "electron_log_disable":
      await manager.log.disable();
      return { disabled: true };

    case "electron_log_clear":
      await manager.log.clear();
      return { cleared: true };

    case "electron_log_start_violations":
      await manager.log.startViolationsReport(args.config);
      return { started: true };

    case "electron_log_stop_violations":
      await manager.log.stopViolationsReport();
      return { stopped: true };

    // ===== Fetch Domain =====
    case "electron_fetch_enable":
      await manager.fetch.enable({
        patterns: args.patterns,
        handleAuthRequests: args.handleAuthRequests,
      });
      return { enabled: true };

    case "electron_fetch_disable":
      await manager.fetch.disable();
      return { disabled: true };

    case "electron_fetch_continue_request":
      await manager.fetch.continueRequest({
        requestId: args.requestId,
        url: args.url,
        method: args.method,
        postData: args.postData,
        headers: args.headers,
      });
      return { continued: true };

    case "electron_fetch_fail_request":
      await manager.fetch.failRequest(args.requestId, args.errorReason);
      return { failed: true };

    case "electron_fetch_fulfill_request":
      await manager.fetch.fulfillRequest({
        requestId: args.requestId,
        responseCode: args.responseCode,
        responseHeaders: args.responseHeaders,
        body: args.body,
      });
      return { fulfilled: true };

    // ===== Animation Domain =====
    case "electron_animation_enable":
      await manager.animation.enable();
      return { enabled: true };

    case "electron_animation_disable":
      await manager.animation.disable();
      return { disabled: true };

    case "electron_animation_set_playback_rate":
      await manager.animation.setPlaybackRate(args.playbackRate);
      return { set: true };

    case "electron_animation_get_playback_rate":
      return manager.animation.getPlaybackRate();

    case "electron_animation_seek":
      await manager.animation.seekAnimations(args.animations, args.currentTime);
      return { seeked: true };

    case "electron_animation_pause":
      await manager.animation.setPaused(args.animations, true);
      return { paused: true };

    case "electron_animation_release":
      await manager.animation.releaseAnimations(args.animations);
      return { released: true };

    // ===== Audits Domain =====
    case "electron_audits_enable":
      await manager.audits.enable();
      return { enabled: true };

    case "electron_audits_disable":
      await manager.audits.disable();
      return { disabled: true };

    case "electron_audits_check_contrast":
      await manager.audits.checkContrast(args.reportAAA);
      return { checked: true };

    case "electron_audits_check_forms":
      return manager.audits.checkFormsIssues();

    // ===== LayerTree Domain =====
    case "electron_layertree_enable":
      await manager.layerTree.enable();
      return { enabled: true };

    case "electron_layertree_disable":
      await manager.layerTree.disable();
      return { disabled: true };

    case "electron_layertree_compositing_reasons":
      return manager.layerTree.compositingReasons(args.layerId);

    case "electron_layertree_make_snapshot":
      return manager.layerTree.makeSnapshot(args.layerId);

    // ===== DOM Snapshot Domain =====
    case "electron_dom_snapshot":
      return manager.domSnapshot.captureSnapshot({
        computedStyles: args.computedStyles || [],
        includePaintOrder: args.includePaintOrder,
        includeDOMRects: args.includeDOMRects,
        includeBlendedBackgroundColors: args.includeBlendedBackgroundColors,
        includeTextColorOpacities: args.includeTextColorOpacities,
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
