import fs from 'node:fs/promises';
import createLogger, { Logger } from '@openfn/logger';

const defaultPkg = {
  name: 'openfn-repo',
  description: 'A repository for modules used by the openfn runtime',
  private: true,
  author: 'Open Function Group <admin@openfn.org>',
  version: '1.0.0',
};

const defaultLogger = createLogger();

// ensure a repo with a package.json exists at this path
// Also returns the package json
export default async (path: string, log: Logger = defaultLogger) => {
  await fs.mkdir(path, { recursive: true });

  const pkgPath = `${path}/package.json`;
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    log.debug('Repo exists');
    return pkg;
  } catch (e) {
    log.debug(`Creating new repo at ${pkgPath}`);
    await fs.writeFile(pkgPath, JSON.stringify(defaultPkg, null, 2));
    return { ...defaultPkg };
  }
};
