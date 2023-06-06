import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';
import { Logger } from '@openfn/logger';
import { getNameAndVersion } from '@openfn/runtime';
import type { Opts } from '../options';

export const validateMonoRepo = async (repoPath: string, log: Logger) => {
  try {
    const raw = await readFile(`${repoPath}/package.json`, 'utf8');
    const pkg = JSON.parse(raw);
    assert(pkg.name === 'adaptors');
  } catch (e) {
    log.error(`ERROR: Adaptors Monorepo not found at ${repoPath}`);
    process.exit(9);
  }
};

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

export type MapAdaptorsToMonorepoOptions = Pick<
  Opts,
  'monorepoPath' | 'adaptors' | 'workflow'
>;

// This will mutate options (adaptors, workflow) to support the monorepo
const mapAdaptorsToMonorepo = async (
  options: MapAdaptorsToMonorepoOptions,
  log: Logger
) => {
  const { adaptors, monorepoPath, workflow } = options;
  if (monorepoPath) {
    await validateMonoRepo(monorepoPath, log);
    log.success(`Loading adaptors from monorepo at ${monorepoPath}`);
    if (adaptors) {
      options.adaptors = adaptors.map((a) => {
        const p = updatePath(a, monorepoPath, log);
        log.info(`Mapped adaptor ${a} to monorepo: ${p.split('=')[1]}`);
        return p;
      });
    }
    if (workflow) {
      Object.values(workflow.jobs).forEach((job) => {
        if (job.adaptor) {
          job.adaptor = updatePath(job.adaptor, monorepoPath, log);
        }
      });
    }
  }
  return options;
};

export default mapAdaptorsToMonorepo;
