import YAML, { Pair, Scalar, isPair, isScalar } from 'yaml';
import { DeployConfig, ProjectState, SpecJob } from './types';
import { Logger } from '@openfn/logger';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getState, getSpec } from './index';
import { DeployError } from './deployError';

async function getAllSpecJobs(
  config: DeployConfig,
  logger: Logger
): Promise<SpecJob[]> {
  const jobs: SpecJob[] = [];

  try {
    const state = await getState(config.statePath);
    const spec = await getSpec(config.specPath);

    for (const [workflowKey, workflow] of Object.entries(spec.doc.workflows)) {
      if (workflow.jobs) {
        for (const [jobKey, specJob] of Object.entries(workflow.jobs)) {
          const stateJob = state.workflows[workflowKey]?.jobs[jobKey];
          stateJob &&
            jobs.push({
              id: stateJob.id,
              name: specJob.name,
              adaptor: specJob.adaptor,
              body: specJob.body,
              credential: specJob.credential,
            });
        }
      }
    }
  } catch (error: any) {
    logger.debug(`Could not read the spec and state: ${error.message}`);
  }

  return jobs;
}

async function extractJobsToDisk(
  specBody: string,
  state: ProjectState,
  oldJobs: SpecJob[],
  config: DeployConfig
): Promise<string> {
  function isPairWithScalarKey(
    node: any
  ): node is Pair & { key: Scalar & { value: string } } {
    return (
      isPair(node) && isScalar(node.key) && typeof node.key.value === 'string'
    );
  }

  const doc = YAML.parseDocument(specBody, { strict: false });

  await YAML.visitAsync(doc, {
    async Pair(_, pair: any, pairPath) {
      if (
        !pair.key ||
        pair.key.value !== 'body' ||
        !isScalar(pair.value) ||
        pairPath.length <= 6
      ) {
        return;
      }

      const jobPair = pairPath[pairPath.length - 2];
      const workflowPair = pairPath[pairPath.length - 6];

      if (!isPairWithScalarKey(jobPair) || !isPairWithScalarKey(workflowPair)) {
        return;
      }

      const jobKey = jobPair.key.value;
      const workflowKey = workflowPair.key.value;

      // find the job in the state
      const stateJob = state.workflows[workflowKey]?.jobs[jobKey];

      if (!stateJob) {
        return;
      }

      // check if the state job is in the old spec jobs
      const oldSpecJob = oldJobs.find((job) => job.id === stateJob.id);

      if (!oldSpecJob || typeof oldSpecJob?.body !== 'object') {
        return;
      }

      const oldSpecJobPath = oldSpecJob.body.path;

      if (oldSpecJobPath) {
        const basePath = path.dirname(config.specPath);
        const resolvedPath = path.resolve(basePath, oldSpecJobPath);
        await writeFile(resolvedPath, pair.value.value);

        // set the body path in the spec
        const map = doc.createNode({ path: oldSpecJobPath });

        pair.value = map;
      }
    },
  });

  if (doc.errors.length > 0) {
    throw new DeployError(doc.errors[0].message, 'SPEC_ERROR');
  }

  return doc.toString();
}

export async function syncRemoteSpec(
  remoteSpecBody: string,
  newState: ProjectState,
  config: DeployConfig,
  logger: Logger
): Promise<string> {
  try {
    const oldSpecJobs = await getAllSpecJobs(config, logger);

    return extractJobsToDisk(remoteSpecBody, newState, oldSpecJobs, config);
  } catch (error: any) {
    logger.warn(`Could not update spec job body paths: ${error.message}`);
    return remoteSpecBody;
  }
}
