import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let version = '';

// find the parenting package.json
// this is non-trivial because the path is different in src and dist builds
export default function getVersion() {
  if (!version) {
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

    const pkg = JSON.parse(fs.readFileSync(nextPath, 'utf-8'));
    version = pkg.version;
  }

  return version;
}
