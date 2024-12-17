import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  fs.readFileSync(
    path.join(fileURLToPath(import.meta.url), '../../../package.json'),
    'utf-8'
  )
);

export default pkg.version;
