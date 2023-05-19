import { readFileSync } from 'node:fs';
import path from 'node:path';

export const getJSON = (pathToJson?: string) => {
  if (!pathToJson) {
    pathToJson = path.resolve('test/fixtures', 'output.json');
  }
  const data = readFileSync(pathToJson, 'utf8');
  return JSON.parse(data);
};

export const extractLogs = (jsonLogString: string) =>
  jsonLogString
    .split(/\n/)
    .filter((j) => j.startsWith('{'))
    .map((j) => JSON.parse(j));

export const assertLog = (t: any, logs: any[], re: RegExp) =>
  t.assert(logs.find(({ message }) => re.test(message[0])));
