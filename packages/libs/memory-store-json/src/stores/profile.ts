/**
 * @ai-stack/memory-store-json - Profile Store
 *
 * JSON-based profile storage for user preferences.
 */

import * as path from 'node:path';
import type {
  IProfileStore,
  ProfileItem,
  ProfileItemInput,
  UUID,
} from '@ai-stack/memory-store-sqlite';
import {
  readJsonFile,
  writeJsonFile,
  ensureDir,
  deleteDir,
  now,
} from '../utils/file-ops.js';

/**
 * Profiles data structure
 */
interface ProfilesData {
  profiles: Record<string, ProfileItem>;
}

/**
 * JSON Profile Store configuration
 */
export interface JsonProfileStoreConfig {
  basePath: string;
}

/**
 * Create a JSON Profile Store instance
 */
export function createJsonProfileStore(config: JsonProfileStoreConfig): IProfileStore {
  const profilesDir = path.join(config.basePath, 'profiles');
  const profilesPath = path.join(profilesDir, 'profiles.json');
  let initialized = false;

  /**
   * Read all profiles
   */
  function readProfiles(): Record<string, ProfileItem> {
    const data = readJsonFile<ProfilesData>(profilesPath, { profiles: {} });
    return data.profiles;
  }

  /**
   * Write all profiles
   */
  function writeProfiles(profiles: Record<string, ProfileItem>): void {
    writeJsonFile(profilesPath, { profiles });
  }

  return {
    async initialize(): Promise<void> {
      ensureDir(profilesDir);
      initialized = true;
    },

    async close(): Promise<void> {
      initialized = false;
    },

    async clear(): Promise<void> {
      deleteDir(profilesDir);
      ensureDir(profilesDir);
    },

    async set(input: ProfileItemInput): Promise<ProfileItem> {
      const profiles = readProfiles();

      const item: ProfileItem = {
        ...input,
        updatedAt: now(),
      };

      profiles[input.key] = item;
      writeProfiles(profiles);

      return item;
    },

    async get(key: string): Promise<ProfileItem | null> {
      const profiles = readProfiles();
      return profiles[key] || null;
    },

    async getAll(): Promise<ProfileItem[]> {
      const profiles = readProfiles();
      return Object.values(profiles);
    },

    async delete(key: string): Promise<boolean> {
      const profiles = readProfiles();

      if (profiles[key]) {
        delete profiles[key];
        writeProfiles(profiles);
        return true;
      }

      return false;
    },

    async has(key: string): Promise<boolean> {
      const profiles = readProfiles();
      return key in profiles;
    },

    async getBySourceEvent(eventId: UUID): Promise<ProfileItem[]> {
      const profiles = readProfiles();
      return Object.values(profiles).filter(p => p.sourceEventId === eventId);
    },
  };
}
