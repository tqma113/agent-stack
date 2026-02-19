/**
 * @ai-stack/provider
 *
 * Multi-model LLM provider for ai-stack monorepo.
 * Supports OpenAI, Anthropic, Google Gemini, and OpenAI-compatible APIs.
 */

// ============================================
// Errors
// ============================================
export * from './errors.js';

// ============================================
// OpenAI (default, backward compatible)
// ============================================
export * from './openai/index.js';

// Re-export toFile utility from openai package
export { toFile } from 'openai';

// ============================================
// Core - Multi-model abstraction
// ============================================
export * from './core/index.js';

// ============================================
// Anthropic (optional)
// ============================================
export * from './anthropic/index.js';

// ============================================
// Google Gemini (optional)
// ============================================
export * from './google/index.js';

// ============================================
// OpenAI-Compatible (Ollama, Groq, etc.)
// ============================================
export * from './openai-compatible/index.js';
