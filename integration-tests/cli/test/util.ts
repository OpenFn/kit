import { readFileSync } from 'node:fs';
import path from 'node:path';

export const getJSON = (pathToJson?: string) => {
  if (!pathToJson) {
    pathToJson = path.resolve('jobs', 'output.json');
  }
  const data = readFileSync(pathToJson, 'utf8');
  return JSON.parse(data);
};
