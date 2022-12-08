import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';

import { Logger } from '@openfn/logger';
import { getNameAndVersion } from '@openfn/runtime';

// TODO also validate the adaptor name
export const validateMonoRepo = async (repoPath: string, log: Logger) => {
  try {
    const raw = await readFile(`${repoPath}/package.json`, 'utf8');
    const pkg = JSON.parse(raw);
    assert(pkg.name === 'adaptors');
  } catch (e) {
    log.error(`ERROR: Monorepo not found at ${repoPath}`);
    throw new Error('Monorepo not found');
  }
};

// TODO I'd like to implement this but not sure about testing it
const buildAdaptor = async () => {};

// Convert an adaptor name into a path to the adaptor in the monorepo
export const updatePath = (adaptor: string, repoPath: string, log: Logger) => {
  if (adaptor.match('=')) {
    // Should do nothing if a path is already provided
    return adaptor;
  }

  const { name, version } = getNameAndVersion(adaptor);
  if (version) {
    // version numbers are ignored with warning
    log.warn(
      `Warning: Ignoring version specifier on ${adaptor} as loading from the adaptors monorepo`
    );
  }
  const shortName = name.replace('@openfn/language-', '');
  const abspath = path.resolve(repoPath, 'packages', shortName);
  return `${name}=${abspath}`;
};

const useAdaptorsRepo = async (
  adaptors: string[],
  repoPath: string,
  log: Logger
) => {
  log.info('Updating adaptor paths to point to the monorepo');
  const updatedAdaptors = adaptors.map((a) => {
    const p = updatePath(a, repoPath, log);
    log.debug(`Mapped ${a} tp ${p}`);
    return p;
  });
  return updatedAdaptors;
};

export default useAdaptorsRepo;
