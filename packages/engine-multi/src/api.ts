// Creates the public/external API to the runtime

import path from 'node:path';
import crypto from 'node:crypto';
import { ExecutionPlan } from '@openfn/runtime';
import createLogger, { JSONLog, Logger } from '@openfn/logger';

import type { AutoinstallOptions } from './api/autoinstall';

export type State = any; // TODO I want a nice state def with generics

// Archive of every workflow we've run
// Fine to just keep in memory for now
type WorkflowStats = {
  id: string;
  name?: string; // TODO what is name? this is irrelevant?
  status: 'pending' | 'done' | 'err';
  startTime?: number;
  threadId?: number;
  duration?: number;
  error?: string;
  result?: any; // State
  plan: ExecutionPlan;
};

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credentials?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

export type RTEOptions = {
  resolvers?: LazyResolvers;
  logger?: Logger;
  workerPath?: string; // TODO maybe the public API doesn't expose this
  repoDir?: string;
  noCompile?: boolean; // Needed for unit tests to support json expressions. Maybe we shouldn't do this?

  autoinstall: AutoinstallOptions;
};

// Create the engine and handle user-facing stuff, like options parsing
// and defaulting
const createAPI = function (serverId?: string, options: RTEOptions = {}) {
  let { repoDir } = options;

  const logger = options.logger || createLogger('RTE', { level: 'debug' });

  if (!repoDir) {
    if (process.env.OPENFN_RTE_REPO_DIR) {
      repoDir = process.env.OPENFN_RTE_REPO_DIR;
    } else {
      repoDir = '/tmp/openfn/repo';
      logger.warn('Using default repodir');
      logger.warn(
        'Set env var OPENFN_RTE_REPO_DIR to use a different directory'
      );
    }
  }

  logger.info('repoDir set to ', repoDir);

  // TODO I dunno, does the engine have an id?
  // I think that's a worker concern, especially
  // as there's a 1:1 worker:engine mapping
  // const id = serverId || crypto.randomUUID();

  // TODO we want to get right down to this

  // Create the internal API
  const engine = createApi(options);

  // Return the external API
  return {
    execute: engine.execute,
    listen: engine.listen,
  };
};

export default createAPI;
