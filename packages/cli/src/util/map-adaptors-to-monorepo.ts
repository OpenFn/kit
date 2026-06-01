import { existsSync } from 'node:fs';
import path from 'node:path';
import { Logger } from '@openfn/logger';
import {
  getNameAndVersion,
  type ExecutionPlan,
  type Job,
} from '@openfn/runtime';

import type { Opts } from '../options';

export const validateMonoRepo = async (repoPaths: string[], log: Logger) => {
  for (const repoPath of repoPaths) {
    if (!existsSync(path.resolve(repoPath, 'packages'))) {
      log.error(`ERROR: Adaptors Monorepo not found at ${repoPath}`);
      process.exit(9);
    }
  }
};

// Convert an adaptor name into a path to the adaptor in the monorepo
export const updatePath = (
  adaptor: string,
  repoPaths: string[],
  log: Logger
) => {
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

  // Find the first root in the monorepo list that contains the adaptor
  // (order is precedence, so an earlier root overrides a later one)
  const abspath = repoPaths
    .map((repoPath) => path.join(repoPath, 'packages', shortName))
    .find((candidate) => existsSync(candidate));

  if (!abspath) {
    if (repoPaths.length > 1) {
      throw new Error(
        `Adaptor ${name} not found in any provided adaptors monorepo`
      );
    } else {
      throw new Error(`Adaptor ${name} not found in the adaptors monorepo`);
    }
  }

  log.info(`Mapped adaptor ${name} to monorepo: ${abspath}`);
  return `${name}=${abspath}`;
};

export type MapAdaptorsToMonorepoOptions = Pick<
  Opts,
  'monorepoPath' | 'adaptors'
>;

const mapAdaptorsToMonorepo = (
  monorepoPath: string[] = [],
  input: string[] | ExecutionPlan = [],
  log: Logger
): string[] | ExecutionPlan => {
  if (monorepoPath.length) {
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
