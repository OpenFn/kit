import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Versions } from '../types';

const pkg = JSON.parse(
  fs.readFileSync(
    path.join(fileURLToPath(import.meta.url), '../../package.json'),
    'utf-8'
  )
);

// Load key versions at init time
const versions = {
  node: process.version.substring(1),
  engine: pkg.version,
  compiler: pkg.dependencies?.['@openfn/compiler'],
  runtime: pkg.dependencies?.['@openfn/runtime'],
};

// Return a shallow clone of versions
// because each workflow will scribble to it
export default (): Versions => ({ ...versions });
