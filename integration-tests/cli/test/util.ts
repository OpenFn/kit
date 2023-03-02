import { readFileSync } from 'node:fs';
import path from 'node:path';

export const getJSON = (pathToJson?: string) => {
  if (!pathToJson) {
    pathToJson = path.resolve('jobs', 'output.json');
  }
  const data = readFileSync(pathToJson, 'utf8');
  return JSON.parse(data);
};

export const extractLogs = (jsonLogString: string) =>
  jsonLogString
    .split(/\n/)
    .filter((j) => j.startsWith('{'))
    .map((j) => JSON.parse(j));
