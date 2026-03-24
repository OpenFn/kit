import * as os from 'node:os';
import * as path from 'node:path';
const homeDir = os.homedir();

export const DEFAULT_REPO_DIR = path.join(homeDir, '/.openfn/repo');
