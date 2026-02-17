/**
 * ProfileStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ProfileStore } from '../../src/stores/profile.js';

describe('ProfileStore', () => {
  let db: Database.Database;
  let store: ProfileStore;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = new ProfileStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('set', () => {
    it('should set a profile item', async () => {
      const item = await store.set({
        key: 'language',
        value: 'Chinese',
        confidence: 0.9,
        explicit: true,
      });

      expect(item.key).toBe('language');
      expect(item.value).toBe('Chinese');
      expect(item.confidence).toBe(0.9);
      expect(item.explicit).toBe(true);
      expect(item.updatedAt).toBeDefined();
    });

    it('should update existing profile item', async () => {
      await store.set({
        key: 'language',
        value: 'English',
        confidence: 0.5,
      });

      const updated = await store.set({
        key: 'language',
        value: 'Chinese',
        confidence: 0.9,
      });

      expect(updated.value).toBe('Chinese');
      expect(updated.confidence).toBe(0.9);

      const all = await store.getAll();
      expect(all.length).toBe(1);
    });

    it('should store complex values as JSON', async () => {
      const complexValue = {
        preferTypeScript: true,
        indentSize: 2,
        useESLint: true,
      };

      await store.set({
        key: 'code_style',
        value: complexValue,
      });

      const retrieved = await store.get('code_style');
      expect(retrieved!.value).toEqual(complexValue);
    });
  });

  describe('get', () => {
    it('should retrieve a profile item by key', async () => {
      await store.set({
        key: 'tone',
        value: 'formal',
        confidence: 0.8,
      });

      const item = await store.get('tone');

      expect(item).not.toBeNull();
      expect(item!.key).toBe('tone');
      expect(item!.value).toBe('formal');
    });

    it('should return null for non-existent key', async () => {
      const item = await store.get('non-existent');
      expect(item).toBeNull();
    });

    it('should return null for expired items', async () => {
      // Set item with expiration in the past
      await store.set({
        key: 'temp_pref',
        value: 'test',
        expiresAt: Date.now() - 1000,
      });

      const item = await store.get('temp_pref');
      expect(item).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should get all non-expired items', async () => {
      await store.set({ key: 'pref1', value: 'value1' });
      await store.set({ key: 'pref2', value: 'value2' });
      await store.set({
        key: 'expired',
        value: 'value3',
        expiresAt: Date.now() - 1000,
      });

      const items = await store.getAll();

      expect(items.length).toBe(2);
      expect(items.map((i) => i.key)).toContain('pref1');
      expect(items.map((i) => i.key)).toContain('pref2');
      expect(items.map((i) => i.key)).not.toContain('expired');
    });
  });

  describe('delete', () => {
    it('should delete a profile item', async () => {
      await store.set({ key: 'to_delete', value: 'test' });

      const deleted = await store.delete('to_delete');
      expect(deleted).toBe(true);

      const item = await store.get('to_delete');
      expect(item).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired key', async () => {
      await store.set({ key: 'existing', value: 'test' });

      const exists = await store.has('existing');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await store.has('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('getBySourceEvent', () => {
    it('should retrieve items by source event ID', async () => {
      await store.set({
        key: 'pref1',
        value: 'value1',
        sourceEventId: 'event-123',
      });
      await store.set({
        key: 'pref2',
        value: 'value2',
        sourceEventId: 'event-123',
      });
      await store.set({
        key: 'pref3',
        value: 'value3',
        sourceEventId: 'event-456',
      });

      const items = await store.getBySourceEvent('event-123');

      expect(items.length).toBe(2);
      items.forEach((item) => expect(item.sourceEventId).toBe('event-123'));
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired items', async () => {
      await store.set({ key: 'valid', value: 'test1' });
      await store.set({
        key: 'expired1',
        value: 'test2',
        expiresAt: Date.now() - 1000,
      });
      await store.set({
        key: 'expired2',
        value: 'test3',
        expiresAt: Date.now() - 2000,
      });

      const removed = await store.cleanupExpired();

      expect(removed).toBe(2);

      const all = await store.getAll();
      expect(all.length).toBe(1);
      expect(all[0].key).toBe('valid');
    });
  });
});
