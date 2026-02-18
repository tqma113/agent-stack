"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/handlers.ts
var handlers_exports = {};
__export(handlers_exports, {
  delete: () => deleteEntries,
  search: () => search,
  upsert: () => upsert
});
module.exports = __toCommonJS(handlers_exports);

// src/store-context.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var import_memory_store_sqlite = require("@ai-stack/memory-store-sqlite");
var DEFAULT_CONFIG = {
  dbPath: ".ai-stack/memory.db",
  debug: false
};
var instance = null;
var db = null;
async function getStoreContext(config = {}) {
  if (instance) {
    return instance;
  }
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const dbDir = path.dirname(mergedConfig.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new import_better_sqlite3.default(mergedConfig.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const events = (0, import_memory_store_sqlite.createEventStore)();
  const tasks = (0, import_memory_store_sqlite.createTaskStateStore)();
  const summaries = (0, import_memory_store_sqlite.createSummaryStore)();
  const profiles = (0, import_memory_store_sqlite.createProfileStore)();
  const semantic = (0, import_memory_store_sqlite.createSemanticStore)();
  events.setDatabase(db);
  tasks.setDatabase(db);
  summaries.setDatabase(db);
  profiles.setDatabase(db);
  semantic.setDatabase(db);
  await events.initialize();
  await tasks.initialize();
  await summaries.initialize();
  await profiles.initialize();
  await semantic.initialize();
  if (mergedConfig.debug) {
    console.log(`[StoreContext] Initialized with database: ${mergedConfig.dbPath}`);
  }
  instance = {
    events,
    tasks,
    summaries,
    profiles,
    semantic,
    async close() {
      await events.close();
      await tasks.close();
      await summaries.close();
      await profiles.close();
      await semantic.close();
      if (db) {
        db.close();
        db = null;
      }
      instance = null;
      if (mergedConfig.debug) {
        console.log("[StoreContext] Closed");
      }
    },
    isInitialized() {
      return events.isInitialized() && tasks.isInitialized() && summaries.isInitialized() && profiles.isInitialized() && semantic.isInitialized();
    }
  };
  return instance;
}

// src/schema.ts
function validateSearchParams(params) {
  if (typeof params !== "object" || params === null) {
    return {};
  }
  const p = params;
  const result = {};
  if (typeof p.query === "string") {
    result.query = p.query;
  }
  if (Array.isArray(p.layers)) {
    const validLayers = ["events", "profiles", "semantic", "summaries", "tasks"];
    result.layers = p.layers.filter(
      (l) => validLayers.includes(l)
    );
  }
  if (typeof p.sessionId === "string") {
    result.sessionId = p.sessionId;
  }
  if (typeof p.limit === "number" && p.limit > 0) {
    result.limit = Math.min(p.limit, 100);
  }
  if (Array.isArray(p.tags)) {
    result.tags = p.tags.filter((t) => typeof t === "string");
  }
  return result;
}
function validateUpsertParams(params) {
  if (typeof params !== "object" || params === null) {
    throw new Error("Invalid upsert params: expected object");
  }
  const p = params;
  const validLayers = ["event", "profile", "semantic", "summary", "task"];
  if (!validLayers.includes(p.layer)) {
    throw new Error(`Invalid layer: ${p.layer}. Must be one of: ${validLayers.join(", ")}`);
  }
  if (typeof p.data !== "object" || p.data === null) {
    throw new Error("Invalid data: expected object");
  }
  return {
    layer: p.layer,
    data: p.data,
    sessionId: typeof p.sessionId === "string" ? p.sessionId : void 0
  };
}
function validateDeleteParams(params) {
  if (typeof params !== "object" || params === null) {
    throw new Error("Invalid delete params: expected object");
  }
  const p = params;
  const validLayers = ["events", "profiles", "semantic", "summaries", "tasks"];
  if (!validLayers.includes(p.layer)) {
    throw new Error(`Invalid layer: ${p.layer}. Must be one of: ${validLayers.join(", ")}`);
  }
  if (typeof p.filter !== "object" || p.filter === null) {
    throw new Error("Invalid filter: expected object");
  }
  const filter = p.filter;
  const result = {};
  if (typeof filter.id === "string") {
    result.id = filter.id;
  }
  if (Array.isArray(filter.ids)) {
    result.ids = filter.ids.filter((id) => typeof id === "string");
  }
  if (typeof filter.sessionId === "string") {
    result.sessionId = filter.sessionId;
  }
  if (typeof filter.beforeTimestamp === "number") {
    result.beforeTimestamp = filter.beforeTimestamp;
  }
  if (typeof filter.key === "string") {
    result.key = filter.key;
  }
  if (Object.keys(result).length === 0) {
    throw new Error("At least one filter criterion must be provided");
  }
  return {
    layer: p.layer,
    filter: result
  };
}

// src/handlers.ts
async function search(args) {
  const params = validateSearchParams(args);
  const ctx = await getStoreContext();
  const layers = params.layers || ["events", "profiles", "semantic", "summaries", "tasks"];
  const limit = params.limit || 10;
  const result = {
    results: [],
    totalCount: 0,
    query: params.query
  };
  for (const layer of layers) {
    try {
      const layerResult = await searchLayer(ctx, layer, params, limit);
      result.results.push(layerResult);
      result.totalCount += layerResult.count;
    } catch (error) {
      console.warn(`[MemorySkill] Error searching ${layer}:`, error.message);
    }
  }
  return JSON.stringify(result, null, 2);
}
async function searchLayer(ctx, layer, params, limit) {
  let items = [];
  switch (layer) {
    case "events": {
      const events = await ctx.events.query({
        sessionId: params.sessionId,
        tags: params.tags,
        limit
      });
      items = events;
      break;
    }
    case "profiles": {
      const profiles = await ctx.profiles.getAll();
      if (params.query) {
        const query = params.query.toLowerCase();
        items = profiles.filter(
          (p) => p.key.toLowerCase().includes(query) || JSON.stringify(p.value).toLowerCase().includes(query)
        );
      } else {
        items = profiles;
      }
      items = items.slice(0, limit);
      break;
    }
    case "semantic": {
      if (params.query) {
        const results = await ctx.semantic.search(params.query, {
          sessionId: params.sessionId,
          tags: params.tags,
          limit
        });
        items = results;
      } else {
        items = [];
      }
      break;
    }
    case "summaries": {
      const summaries = await ctx.summaries.list({
        sessionId: params.sessionId,
        limit
      });
      items = summaries;
      break;
    }
    case "tasks": {
      const tasks = await ctx.tasks.list({
        sessionId: params.sessionId,
        limit
      });
      items = tasks;
      break;
    }
  }
  return {
    layer,
    count: items.length,
    items
  };
}
async function upsert(args) {
  const params = validateUpsertParams(args);
  const ctx = await getStoreContext();
  let result;
  switch (params.layer) {
    case "event": {
      const eventData = params.data;
      const event = await ctx.events.add({
        type: eventData.type || "SYSTEM",
        summary: eventData.summary || "",
        payload: eventData.payload || {},
        sessionId: params.sessionId || eventData.sessionId,
        intent: eventData.intent,
        entities: eventData.entities || [],
        links: eventData.links || [],
        tags: eventData.tags || [],
        parentId: eventData.parentId
      });
      result = {
        success: true,
        layer: "event",
        id: event.id,
        action: "created"
      };
      break;
    }
    case "profile": {
      const profileData = params.data;
      if (!profileData.key) {
        throw new Error("Profile key is required");
      }
      const existing = await ctx.profiles.get(profileData.key);
      const profile = await ctx.profiles.set({
        key: profileData.key,
        value: profileData.value,
        confidence: profileData.confidence ?? 0.8,
        explicit: profileData.explicit ?? true,
        sourceEventId: profileData.sourceEventId,
        expiresAt: profileData.expiresAt
      });
      result = {
        success: true,
        layer: "profile",
        id: profile.key,
        action: existing ? "updated" : "created"
      };
      break;
    }
    case "semantic": {
      const chunkData = params.data;
      if (!chunkData.text) {
        throw new Error("Semantic chunk text is required");
      }
      const chunk = await ctx.semantic.add({
        text: chunkData.text,
        tags: chunkData.tags || [],
        sessionId: params.sessionId || chunkData.sessionId,
        sourceEventId: chunkData.sourceEventId,
        sourceType: chunkData.sourceType,
        metadata: chunkData.metadata,
        embedding: chunkData.embedding
      });
      result = {
        success: true,
        layer: "semantic",
        id: chunk.id,
        action: "created"
      };
      break;
    }
    case "summary": {
      const summaryData = params.data;
      if (!summaryData.short || !summaryData.sessionId) {
        throw new Error("Summary short text and sessionId are required");
      }
      const summary = await ctx.summaries.add({
        sessionId: params.sessionId || summaryData.sessionId,
        short: summaryData.short,
        bullets: summaryData.bullets || [],
        decisions: summaryData.decisions || [],
        todos: summaryData.todos || [],
        coveredEventIds: summaryData.coveredEventIds || [],
        tokenCount: summaryData.tokenCount
      });
      result = {
        success: true,
        layer: "summary",
        id: summary.id,
        action: "created"
      };
      break;
    }
    case "task": {
      const taskData = params.data;
      if (taskData.id) {
        const existing = await ctx.tasks.get(taskData.id);
        if (existing) {
          const updated = await ctx.tasks.update(taskData.id, {
            goal: taskData.goal,
            status: taskData.status,
            constraints: taskData.constraints,
            plan: taskData.plan,
            done: taskData.done,
            blocked: taskData.blocked,
            nextAction: taskData.nextAction,
            metadata: taskData.metadata,
            actionId: taskData.actionId
          });
          result = {
            success: true,
            layer: "task",
            id: updated.id,
            action: "updated"
          };
          break;
        }
      }
      if (!taskData.goal) {
        throw new Error("Task goal is required");
      }
      const task = await ctx.tasks.create({
        goal: taskData.goal,
        status: taskData.status || "pending",
        constraints: taskData.constraints || [],
        plan: taskData.plan || [],
        done: taskData.done || [],
        blocked: taskData.blocked || [],
        nextAction: taskData.nextAction,
        sessionId: params.sessionId || taskData.sessionId,
        metadata: taskData.metadata
      });
      result = {
        success: true,
        layer: "task",
        id: task.id,
        action: "created"
      };
      break;
    }
    default:
      throw new Error(`Unknown layer: ${params.layer}`);
  }
  return JSON.stringify(result, null, 2);
}
async function deleteEntries(args) {
  const params = validateDeleteParams(args);
  const ctx = await getStoreContext();
  let deletedCount = 0;
  switch (params.layer) {
    case "events": {
      if (params.filter.id) {
        const deleted = await ctx.events.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.ids && params.filter.ids.length > 0) {
        deletedCount = await ctx.events.deleteBatch(params.filter.ids);
      } else if (params.filter.sessionId) {
        deletedCount = await ctx.events.deleteBySession(params.filter.sessionId);
      } else if (params.filter.beforeTimestamp) {
        deletedCount = await ctx.events.deleteBeforeTimestamp(params.filter.beforeTimestamp);
      }
      break;
    }
    case "profiles": {
      if (params.filter.key) {
        const deleted = await ctx.profiles.delete(params.filter.key);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.id) {
        const deleted = await ctx.profiles.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      }
      break;
    }
    case "semantic": {
      if (params.filter.id) {
        const deleted = await ctx.semantic.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.sessionId) {
        deletedCount = await ctx.semantic.deleteBySession(params.filter.sessionId);
      }
      break;
    }
    case "summaries":
    case "tasks": {
      console.warn(`[MemorySkill] Delete not implemented for ${params.layer} layer`);
      break;
    }
  }
  const result = {
    success: deletedCount > 0,
    layer: params.layer,
    deletedCount
  };
  return JSON.stringify(result, null, 2);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  delete: null,
  search,
  upsert
});
//# sourceMappingURL=handlers.cjs.map