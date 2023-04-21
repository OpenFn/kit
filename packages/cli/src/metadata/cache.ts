import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const getPath = (repoDir: string, key: string) => `${repoDir}/meta/${key}.json`;

// Sort keys on a json object so that the same object with different key order returns the same cache id
// At this stage we're not sorting values (apart from objects)
const sortKeys = (obj: Record<string, any>) => {
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

const generateKey = (config: any, adaptor: string) => {
  const sorted = sortKeys(config);
  const key = `${JSON.stringify(sorted)}-${adaptor}}`;
  return createHash('sha256').update(key).digest('hex');
};

const get = (repoPath: string, key: string) => {
  try {
    const data = readFileSync(getPath(repoPath, key), 'utf8');
    const json = JSON.parse(data);
    return json;
  } catch (e) {
    return null;
  }
};

// lock the cache to prevent another process generating
// this is very similar to how docgen works
// /const lock = async (repoPath: string, key: string) => {};

const set = async (repoPath: string, key: string, data: any) => {
  const fullPath = getPath(repoPath, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, JSON.stringify(data));
};

export default { get, set, generateKey, getPath, sortKeys };
