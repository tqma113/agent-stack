/**
 * WritePolicyEngine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWritePolicyEngine, type IWritePolicyEngine } from '../src/write-policy.js';
import { ProfileKeyNotAllowedError } from '../src/errors.js';
import type { MemoryEvent, ProfileItem, WritePolicyConfig } from '../src/types.js';

const defaultConfig: WritePolicyConfig = {
  minConfidence: 0.5,
  autoSummarize: true,
  summarizeEveryNEvents: 20,
  summarizeTokenThreshold: 4000,
  profileKeyWhitelist: null,
  conflictStrategy: 'latest',
  timeDecayFactor: 0.9,
  staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
};

describe('WritePolicyEngine', () => {
  let engine: IWritePolicyEngine;

  beforeEach(() => {
    engine = createWritePolicyEngine(defaultConfig);
  });

  describe('validateProfileKey', () => {
    it('should allow any key when whitelist is null', () => {
      expect(() => engine.validateProfileKey('any_key')).not.toThrow();
      expect(() => engine.validateProfileKey('language')).not.toThrow();
    });

    it('should throw for keys not in whitelist', () => {
      const restrictedEngine = createWritePolicyEngine({
        ...defaultConfig,
        profileKeyWhitelist: ['language', 'tone'],
      });

      expect(() => restrictedEngine.validateProfileKey('language')).not.toThrow();
      expect(() => restrictedEngine.validateProfileKey('invalid_key')).toThrow(
        ProfileKeyNotAllowedError
      );
    });
  });

  describe('decideWrite', () => {
    it('should write DECISION events to semantic and summary', () => {
      const event: MemoryEvent = {
        id: 'test-id',
        type: 'DECISION',
        summary: 'Decided to use React',
        payload: { reasoning: 'Better performance' },
        timestamp: Date.now(),
        sessionId: 'test',
        tags: [],
        entities: [],
      };

      const decision = engine.decideWrite(event);

      expect(decision.shouldWrite).toBe(true);
      expect(decision.targetLayers).toContain('semantic');
      expect(decision.targetLayers).toContain('summary');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should write STATE_CHANGE events to semantic', () => {
      const event: MemoryEvent = {
        id: 'test-id',
        type: 'STATE_CHANGE',
        summary: 'Status changed to in_progress',
        payload: {},
        timestamp: Date.now(),
        sessionId: 'test',
        tags: [],
        entities: [],
      };

      const decision = engine.decideWrite(event);

      expect(decision.shouldWrite).toBe(true);
      expect(decision.targetLayers).toContain('semantic');
    });

    it('should detect preference indicators in USER_MSG', () => {
      const event: MemoryEvent = {
        id: 'test-id',
        type: 'USER_MSG',
        summary: 'Please always use Chinese',
        payload: { content: 'Please always use Chinese for responses' },
        timestamp: Date.now(),
        sessionId: 'test',
        tags: [],
        entities: [],
      };

      const decision = engine.decideWrite(event);

      expect(decision.shouldWrite).toBe(true);
      expect(decision.targetLayers).toContain('profile');
    });

    it('should not write low-value events', () => {
      const event: MemoryEvent = {
        id: 'test-id',
        type: 'USER_MSG',
        summary: 'ok',
        payload: { content: 'ok' },
        timestamp: Date.now(),
        sessionId: 'test',
        tags: [],
        entities: [],
      };

      const decision = engine.decideWrite(event);

      expect(decision.shouldWrite).toBe(false);
      expect(decision.targetLayers.length).toBe(0);
    });
  });

  describe('resolveConflict', () => {
    const oldItem: ProfileItem = {
      key: 'language',
      value: 'English',
      updatedAt: Date.now() - 10000,
      confidence: 0.7,
      explicit: false,
    };

    it('should use latest value with strategy "latest"', () => {
      const newItem: ProfileItem = {
        key: 'language',
        value: 'Chinese',
        updatedAt: Date.now(),
        confidence: 0.5,
        explicit: false,
      };

      const resolution = engine.resolveConflict('language', oldItem, newItem);

      expect(resolution.winner).toBe('Chinese');
      expect(resolution.needsReview).toBe(false);
    });

    it('should use higher confidence with strategy "confidence"', () => {
      const confidenceEngine = createWritePolicyEngine({
        ...defaultConfig,
        conflictStrategy: 'confidence',
      });

      const newItem: ProfileItem = {
        key: 'language',
        value: 'Chinese',
        updatedAt: Date.now(),
        confidence: 0.9,
        explicit: false,
      };

      const resolution = confidenceEngine.resolveConflict('language', oldItem, newItem);

      expect(resolution.winner).toBe('Chinese');
    });

    it('should prefer explicit with strategy "explicit"', () => {
      const explicitEngine = createWritePolicyEngine({
        ...defaultConfig,
        conflictStrategy: 'explicit',
      });

      const newItem: ProfileItem = {
        key: 'language',
        value: 'Chinese',
        updatedAt: Date.now(),
        confidence: 0.5,
        explicit: true,
      };

      const resolution = explicitEngine.resolveConflict('language', oldItem, newItem);

      expect(resolution.winner).toBe('Chinese');
      expect(resolution.reason).toContain('explicit');
    });

    it('should require review with strategy "manual"', () => {
      const manualEngine = createWritePolicyEngine({
        ...defaultConfig,
        conflictStrategy: 'manual',
      });

      const newItem: ProfileItem = {
        key: 'language',
        value: 'Chinese',
        updatedAt: Date.now(),
        confidence: 0.9,
        explicit: true,
      };

      const resolution = manualEngine.resolveConflict('language', oldItem, newItem);

      expect(resolution.needsReview).toBe(true);
    });
  });

  describe('calculateDecay', () => {
    it('should return 1 for current timestamp', () => {
      const decay = engine.calculateDecay(Date.now());
      expect(decay).toBeCloseTo(1, 1);
    });

    it('should return lower value for older timestamps', () => {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const decay = engine.calculateDecay(oneWeekAgo);
      expect(decay).toBeLessThan(1);
    });
  });

  describe('isStale', () => {
    it('should return false for recent timestamps', () => {
      expect(engine.isStale(Date.now())).toBe(false);
    });

    it('should return true for old timestamps', () => {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      expect(engine.isStale(twoWeeksAgo)).toBe(true);
    });
  });

  describe('shouldSummarize', () => {
    it('should return true when event count exceeds threshold', () => {
      const result = engine.shouldSummarize(25, 0);
      expect(result.should).toBe(true);
      expect(result.reason).toContain('Event count');
    });

    it('should return true when token count exceeds threshold', () => {
      const result = engine.shouldSummarize(0, 5000);
      expect(result.should).toBe(true);
      expect(result.reason).toContain('Token threshold');
    });

    it('should return false when thresholds not met', () => {
      const result = engine.shouldSummarize(5, 1000);
      expect(result.should).toBe(false);
    });

    it('should return false when autoSummarize is disabled', () => {
      const noAutoEngine = createWritePolicyEngine({
        ...defaultConfig,
        autoSummarize: false,
      });

      const result = noAutoEngine.shouldSummarize(100, 10000);
      expect(result.should).toBe(false);
    });
  });

  describe('extractPreferences', () => {
    it('should extract language preferences', () => {
      const prefs = engine.extractPreferences('Please use Chinese for all responses');

      expect(prefs.length).toBeGreaterThan(0);
      const langPref = prefs.find((p) => p.key === 'language');
      expect(langPref).toBeDefined();
      expect(langPref!.value).toBe('Chinese');
    });

    it('should extract format preferences', () => {
      const prefs = engine.extractPreferences('I prefer markdown format');

      const formatPref = prefs.find((p) => p.key === 'response_format');
      expect(formatPref).toBeDefined();
      expect(formatPref!.value).toBe('markdown');
    });

    it('should extract verbosity preferences', () => {
      const prefs = engine.extractPreferences('Be more concise please');

      const verbPref = prefs.find((p) => p.key === 'verbosity');
      expect(verbPref).toBeDefined();
      expect(verbPref!.value).toBe('concise');
    });

    it('should extract tone preferences', () => {
      const prefs = engine.extractPreferences('Please be more formal in your responses');

      const tonePref = prefs.find((p) => p.key === 'tone');
      expect(tonePref).toBeDefined();
      expect(tonePref!.value).toBe('formal');
    });

    it('should return empty array for content without preferences', () => {
      const prefs = engine.extractPreferences('What is the weather today?');
      expect(prefs.length).toBe(0);
    });
  });
});
