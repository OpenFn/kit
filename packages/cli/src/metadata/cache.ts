import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const getPath = (repoDir: string, key: string) => `${repoDir}/meta/${key}.json`;

// TODO should we sort keys so that equivalent objects generate the same key?
const generateKey = (config: any) =>
  createHash('sha256').update(JSON.stringify(config)).digest('hex');

const get = (repoPath: string, key: string) => {
  try {
    const data = readFileSync(getPath(repoPath, key));
    const json = JSON.parse(data);
    return json;
  } catch (e) {
    return null;
  }
};

// lock the cache to prevent another process generating
// this is very similar to how docgen works
const lock = async (repoPath: string, key: string) => {};

const set = async (repoPath: string, key: string, data: any) => {
  const fullPath = getPath(repoPath, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, JSON.stringify(data));
};

export default { get, set, generateKey, getPath };
