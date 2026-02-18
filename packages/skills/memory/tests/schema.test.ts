/**
 * Tests for Schema Validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateSearchParams,
  validateUpsertParams,
  validateDeleteParams,
} from '../src/schema.js';

describe('validateSearchParams', () => {
  it('should return empty object for null input', () => {
    expect(validateSearchParams(null)).toEqual({});
  });

  it('should return empty object for non-object input', () => {
    expect(validateSearchParams('string')).toEqual({});
    expect(validateSearchParams(123)).toEqual({});
  });

  it('should extract valid query', () => {
    const result = validateSearchParams({ query: 'test query' });
    expect(result.query).toBe('test query');
  });

  it('should extract valid layers', () => {
    const result = validateSearchParams({
      layers: ['events', 'profiles', 'invalid'],
    });
    expect(result.layers).toEqual(['events', 'profiles']);
  });

  it('should extract sessionId', () => {
    const result = validateSearchParams({ sessionId: 'session-123' });
    expect(result.sessionId).toBe('session-123');
  });

  it('should cap limit at 100', () => {
    const result = validateSearchParams({ limit: 200 });
    expect(result.limit).toBe(100);
  });

  it('should pass through valid limit', () => {
    const result = validateSearchParams({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  it('should filter tags to strings only', () => {
    const result = validateSearchParams({
      tags: ['tag1', 123, 'tag2', null, 'tag3'],
    });
    expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
});

describe('validateUpsertParams', () => {
  it('should throw for null input', () => {
    expect(() => validateUpsertParams(null)).toThrow('Invalid upsert params');
  });

  it('should throw for non-object input', () => {
    expect(() => validateUpsertParams('string')).toThrow('Invalid upsert params');
  });

  it('should throw for invalid layer', () => {
    expect(() => validateUpsertParams({ layer: 'invalid', data: {} })).toThrow('Invalid layer');
  });

  it('should throw for missing data', () => {
    expect(() => validateUpsertParams({ layer: 'event' })).toThrow('Invalid data');
  });

  it('should validate event layer', () => {
    const result = validateUpsertParams({
      layer: 'event',
      data: { type: 'USER_MSG', summary: 'test' },
    });
    expect(result.layer).toBe('event');
    expect(result.data).toEqual({ type: 'USER_MSG', summary: 'test' });
  });

  it('should validate profile layer', () => {
    const result = validateUpsertParams({
      layer: 'profile',
      data: { key: 'name', value: 'John' },
    });
    expect(result.layer).toBe('profile');
  });

  it('should validate semantic layer', () => {
    const result = validateUpsertParams({
      layer: 'semantic',
      data: { text: 'content chunk' },
    });
    expect(result.layer).toBe('semantic');
  });

  it('should validate summary layer', () => {
    const result = validateUpsertParams({
      layer: 'summary',
      data: { short: 'summary text', sessionId: 's-1' },
    });
    expect(result.layer).toBe('summary');
  });

  it('should validate task layer', () => {
    const result = validateUpsertParams({
      layer: 'task',
      data: { goal: 'complete task' },
    });
    expect(result.layer).toBe('task');
  });

  it('should extract optional sessionId', () => {
    const result = validateUpsertParams({
      layer: 'event',
      data: {},
      sessionId: 'session-123',
    });
    expect(result.sessionId).toBe('session-123');
  });
});

describe('validateDeleteParams', () => {
  it('should throw for null input', () => {
    expect(() => validateDeleteParams(null)).toThrow('Invalid delete params');
  });

  it('should throw for invalid layer', () => {
    expect(() =>
      validateDeleteParams({
        layer: 'invalid',
        filter: { id: '123' },
      })
    ).toThrow('Invalid layer');
  });

  it('should throw for missing filter', () => {
    expect(() => validateDeleteParams({ layer: 'events' })).toThrow('Invalid filter');
  });

  it('should throw for empty filter', () => {
    expect(() =>
      validateDeleteParams({
        layer: 'events',
        filter: {},
      })
    ).toThrow('At least one filter criterion');
  });

  it('should accept id filter', () => {
    const result = validateDeleteParams({
      layer: 'events',
      filter: { id: 'event-123' },
    });
    expect(result.filter.id).toBe('event-123');
  });

  it('should accept ids filter', () => {
    const result = validateDeleteParams({
      layer: 'events',
      filter: { ids: ['e-1', 'e-2'] },
    });
    expect(result.filter.ids).toEqual(['e-1', 'e-2']);
  });

  it('should accept sessionId filter', () => {
    const result = validateDeleteParams({
      layer: 'events',
      filter: { sessionId: 'session-123' },
    });
    expect(result.filter.sessionId).toBe('session-123');
  });

  it('should accept beforeTimestamp filter', () => {
    const result = validateDeleteParams({
      layer: 'events',
      filter: { beforeTimestamp: 1000000 },
    });
    expect(result.filter.beforeTimestamp).toBe(1000000);
  });

  it('should accept key filter for profiles', () => {
    const result = validateDeleteParams({
      layer: 'profiles',
      filter: { key: 'user-preference' },
    });
    expect(result.filter.key).toBe('user-preference');
  });

  it('should filter out non-string ids', () => {
    const result = validateDeleteParams({
      layer: 'events',
      filter: { ids: ['e-1', 123, 'e-2', null] },
    });
    expect(result.filter.ids).toEqual(['e-1', 'e-2']);
  });
});
