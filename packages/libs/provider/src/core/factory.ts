/**
 * Provider Factory
 *
 * Creates provider instances based on configuration.
 */

import type { ProviderConfig, ProviderInstance } from './types.js';

/**
 * Create a provider instance based on configuration
 *
 * @example
 * ```typescript
 * // OpenAI
 * const openai = createProvider({ provider: 'openai' });
 *
 * // Anthropic
 * const claude = createProvider({
 *   provider: 'anthropic',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * // Google Gemini
 * const gemini = createProvider({
 *   provider: 'google',
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * // OpenAI-compatible (Ollama)
 * const ollama = createProvider({
 *   provider: 'openai-compatible',
 *   baseURL: 'http://localhost:11434/v1',
 * });
 * ```
 */
export function createProvider(config: ProviderConfig): ProviderInstance {
  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider(config);

    case 'anthropic':
      return createAnthropicProvider(config);

    case 'google':
      return createGoogleProvider(config);

    case 'openai-compatible':
      return createOpenAICompatibleProvider(config);

    default:
      throw new Error(`Unknown provider: ${(config as ProviderConfig).provider}`);
  }
}

/**
 * Create OpenAI provider (lazy import)
 */
function createOpenAIProvider(
  config: Extract<ProviderConfig, { provider: 'openai' }>
): ProviderInstance {
  // Dynamic import to allow tree-shaking
  const { createOpenAIAdapter } = require('../openai/adapter.js');
  return createOpenAIAdapter(config);
}

/**
 * Create Anthropic provider (lazy import)
 */
function createAnthropicProvider(
  config: Extract<ProviderConfig, { provider: 'anthropic' }>
): ProviderInstance {
  // Dynamic import for optional dependency
  try {
    const { createAnthropicAdapter } = require('../anthropic/adapter.js');
    return createAnthropicAdapter(config);
  } catch (error) {
    throw new Error(
      'Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk'
    );
  }
}

/**
 * Create Google provider (lazy import)
 */
function createGoogleProvider(
  config: Extract<ProviderConfig, { provider: 'google' }>
): ProviderInstance {
  // Dynamic import for optional dependency
  try {
    const { createGoogleAdapter } = require('../google/adapter.js');
    return createGoogleAdapter(config);
  } catch (error) {
    throw new Error(
      'Google Generative AI SDK not installed. Run: npm install @google/generative-ai'
    );
  }
}

/**
 * Create OpenAI-compatible provider (lazy import)
 */
function createOpenAICompatibleProvider(
  config: Extract<ProviderConfig, { provider: 'openai-compatible' }>
): ProviderInstance {
  const { createOpenAICompatibleAdapter } = require('../openai-compatible/adapter.js');
  return createOpenAICompatibleAdapter(config);
}

/**
 * Check if a provider SDK is available
 */
export function isProviderAvailable(provider: ProviderConfig['provider']): boolean {
  switch (provider) {
    case 'openai':
    case 'openai-compatible':
      // OpenAI is a required dependency
      return true;

    case 'anthropic':
      try {
        require('@anthropic-ai/sdk');
        return true;
      } catch {
        return false;
      }

    case 'google':
      try {
        require('@google/generative-ai');
        return true;
      } catch {
        return false;
      }

    default:
      return false;
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): ProviderConfig['provider'][] {
  const providers: ProviderConfig['provider'][] = ['openai', 'openai-compatible'];

  if (isProviderAvailable('anthropic')) {
    providers.push('anthropic');
  }

  if (isProviderAvailable('google')) {
    providers.push('google');
  }

  return providers;
}
