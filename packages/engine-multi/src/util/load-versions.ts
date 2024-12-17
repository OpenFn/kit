import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Versions } from '../types';

let pkg: any;

function getPkg(): any {
  if (!pkg) {
    let nextPath = path.dirname(fileURLToPath(import.meta.url));
    while (nextPath) {
      const pkgPath = path.resolve(nextPath, 'package.json');
      try {
        fs.statSync(pkgPath);
        nextPath = pkgPath;
        break;
      } catch (e) {
        nextPath = path.dirname(nextPath);
      }
    }

    pkg = JSON.parse(fs.readFileSync(nextPath, 'utf-8'));
  }
  return pkg;
}

// Return a shallow clone of versions
// because each workflow will scribble to it
export default (): Versions => {
  const pkg = getPkg();
  return {
    node: process.version.substring(1),
    engine: pkg.version,
    compiler: pkg.dependencies?.['@openfn/compiler'],
    runtime: pkg.dependencies?.['@openfn/runtime'],
  };
};
