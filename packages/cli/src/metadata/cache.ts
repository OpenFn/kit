import { getNameAndVersion } from '@openfn/runtime';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const UNSUPPORTED_FILE_NAME = 'unsupported.json';

export type AdaptorConfiguration = Record<string, any>;

export interface AdaptorMetadata {
  name: string;
  type: string;
  children: any[];
  [key: string]: any; // Allow additional properties
}

export interface CachedMetadata extends AdaptorMetadata {
  created: string; // ISO timestamp added by decorateMetadata
}

export type UnsupportedAdaptorCache = {
  [adaptorName: string]: UnsupportedAdaptorEntry;
};

export interface UnsupportedAdaptorEntry {
  lastCheckedVersion: string;
  majorMinor: string;
  timestamp: number;
}

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  majorMinor: string;
}

export type CacheResult<T> = T | null;

// Return the path to the metadata cache inside the CLI repo
export const getCachePath = (repoDir: string, key?: string): string => {
  const base = path.join(repoDir, 'meta');
  if (key) {
    return path.join(base, key.endsWith('.json') ? key : `${key}.json`);
  }
  return base;
};

export const getCache = async (repoDir: string, key: string) => {
  try {
    const cachePath = getCachePath(repoDir, key);
    const content = await readFile(cachePath, 'utf8');
    return JSON.parse(content) as UnsupportedAdaptorCache;
  } catch (e) {
    return null;
  }
};

export const getUnsupportedCache = (repoDir: string) =>
  getCache(repoDir, UNSUPPORTED_FILE_NAME);

// Sort keys on a json object so that the same object with different key order returns the same cache id
// At this stage we're not sorting values (apart from objects)
export const sortKeys = (obj: Record<string, any>): Record<string, any> => {
  const newObj = {} as Record<string, any>;
  Object.keys(obj)
    .sort()
    .forEach((k: string) => {
      const v = obj[k];
      if (!v || typeof v == 'string' || !isNaN(v) || Array.isArray(v)) {
        newObj[k] = v;
      } else {
        newObj[k] = sortKeys(v);
      }
    });
  return newObj;
};

export const generateKey = (
  config: AdaptorConfiguration,
  adaptor: string
): string => {
  const sorted = sortKeys(config);
  const key = `${JSON.stringify(sorted)}-${adaptor}`;
  return createHash('sha256').update(key).digest('hex');
};

export const get = async <T = CachedMetadata>(
  repoPath: string,
  key: string
): Promise<CacheResult<T>> => {
  const p = getCachePath(repoPath, key);
  try {
    const result = await readFile(p, 'utf8');
    return JSON.parse(result) as T;
  } catch (e) {
    return null;
  }
};

export const set = async <T = CachedMetadata>(
  repoPath: string,
  key: string,
  result: T
): Promise<void> => {
  const p = getCachePath(repoPath, key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(result));
};

const getUnsupportedCachePath = (repoDir: string): string => {
  return getCachePath(repoDir, UNSUPPORTED_FILE_NAME);
};

const parseVersion = (version: string): ParsedVersion => {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    majorMinor: `${parts[0] || 0}.${parts[1] || 0}`,
  };
};

const compareVersions = (version1: string, version2: string): number => {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  return v1.patch - v2.patch;
};

// Return true if we know that this adaptor does not support metadata
// If the adaptor version has not been checked before, return false
export const isAdaptorUnsupported = async (
  adaptorSpecifier: string,
  repoDir: string
): Promise<boolean> => {
  const { name, version } = getNameAndVersion(adaptorSpecifier);
  if (!version) return false;

  const cache = await getUnsupportedCache(repoDir);
  if (!cache || !cache[name]) {
    // Cache doesn't exist or is invalid, that's fine
    return false;
  }
  const cached = cache[name];

  const currentParsed = parseVersion(version);
  const cachedParsed = parseVersion(cached.lastCheckedVersion);

  // If current version's major.minor is higher than cached, we should check again
  if (
    currentParsed.major > cachedParsed.major ||
    (currentParsed.major === cachedParsed.major &&
      currentParsed.minor > cachedParsed.minor)
  ) {
    return false; // Allow checking this higher version
  }

  // If major.minor is same or lower, assume it doesn't support metadata
  return true;
};

export const markAdaptorAsUnsupported = async (
  adaptorSpecifier: string,
  repoDir: string
): Promise<void> => {
  const { name, version } = getNameAndVersion(adaptorSpecifier);
  if (!version) return;

  const cachePath = getUnsupportedCachePath(repoDir);
  let cache: UnsupportedAdaptorCache = {};

  try {
    const cacheContent = await readFile(cachePath, 'utf8');
    cache = JSON.parse(cacheContent);
  } catch (error) {
    // Cache doesn't exist, start fresh
  }

  const parsed = parseVersion(version);

  // Only update cache if this version is higher than what we've seen
  const existing = cache[name];
  if (!existing || compareVersions(version, existing.lastCheckedVersion) > 0) {
    cache[name] = {
      lastCheckedVersion: version,
      majorMinor: parsed.majorMinor,
      timestamp: Date.now(),
    };

    // Ensure cache directory exists
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(cache, null, 2));
  }
};

export const getCacheInfo = async (
  repoDir: string
): Promise<{
  supportedCount: number;
  unsupportedCount: number;
  cacheDir: string;
}> => {
  const cacheDir = getCachePath(repoDir);
  let supportedCount = 0;
  let unsupportedCount = 0;

  try {
    const files = await readdir(cacheDir);
    supportedCount = files.filter(
      (f) => f.endsWith('.json') && !f.endsWith(UNSUPPORTED_FILE_NAME)
    ).length;
  } catch (error) {
    // Cache directory doesn't exist, no problem
  }

  try {
    const unsupportedPath = getUnsupportedCachePath(repoDir);
    const content = await readFile(unsupportedPath, 'utf8');
    const cache: UnsupportedAdaptorCache = JSON.parse(content);
    unsupportedCount = Object.keys(cache).length;
  } catch (error) {
    // Unsupported cache doesn't exist, no problem
  }

  return {
    supportedCount,
    unsupportedCount,
    cacheDir,
  };
};

export const clearCache = async (repoDir: string): Promise<void> => {
  const cacheDir = getCachePath(repoDir);
  try {
    await rm(cacheDir, { recursive: true, force: true });
  } catch (error) {
    // Cache directory might not exist, that's fine
  }
};
