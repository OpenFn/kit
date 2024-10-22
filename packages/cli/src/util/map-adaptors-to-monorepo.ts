import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';
import { Logger } from '@openfn/logger';
import { getNameAndVersion } from '@openfn/runtime';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

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

  log.info(`Mapped adaptor ${name} to monorepo: ${abspath}`);
  return `${name}=${abspath}`;
};

export type MapAdaptorsToMonorepoOptions = Pick<
  Opts,
  'monorepoPath' | 'adaptors'
>;

const mapAdaptorsToMonorepo = (
  monorepoPath: string = '',
  input: string[] | ExecutionPlan = [],
  log: Logger
): string[] | ExecutionPlan => {
  if (monorepoPath) {
    if (Array.isArray(input)) {
      const adaptors = input as string[];
      return adaptors.map((a) => updatePath(a, monorepoPath, log));
    }

    const plan = input as ExecutionPlan;
    Object.values(plan.workflow.steps).forEach((step) => {
      const job = step as Job;
      if (job.adaptors) {
        job.adaptors = job.adaptors.map((a) =>
          updatePath(a, monorepoPath, log)
        );
      }
    });

    return plan;
  }
  return input;
};

export default mapAdaptorsToMonorepo;
