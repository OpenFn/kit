import nodepath from 'node:path';
import os from 'node:os';

export default (path: string, root?: string) => {
  // Special handling for ~ feels like a necessary evil
  return path.startsWith('~')
    ? path.replace(`~`, os.homedir)
    : nodepath.resolve(root ?? '', path);
};
