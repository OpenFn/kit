import fs from 'node:fs';
import path from 'node:path';

export const loadFile = (filePath: string) => fs.readFileSync(path.resolve(filePath), 'utf8');
