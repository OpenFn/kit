// Creates the public/external API to the runtime

import path from 'node:path';
import crypto from 'node:crypto';
import { ExecutionPlan } from '@openfn/runtime';
import createLogger, { JSONLog, Logger } from '@openfn/logger';

import createEngine from './engine';
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
  repoDir?: string;

  noCompile?: boolean; // Needed for unit tests to support json expressions. Maybe we shouldn't do this?
  compile?: {
    skip: true;
  };

  autoinstall?: AutoinstallOptions;
};

// Create the engine and handle user-facing stuff, like options parsing
// and defaulting
const createAPI = function (options: RTEOptions = {}) {
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

  const engineOptions = {
    logger,
    resolvers: options.resolvers, // TODO should probably default these?
    repoDir,

    // TODO should map this down into compile.
    noCompile: options.compile?.skip ?? false,
    // TODO should we disable autoinstall overrides?
    autoinstall: options.autoinstall,
  };

  // Create the internal API
  // TMP: use the mock worker for now
  const engine = createEngine(
    engineOptions,
    path.resolve('dist/mock-worker.js')
  );

  // Return the external API
  return {
    execute: engine.execute,
    listen: engine.listen,

    // TODO what about a general on or once?
  };
};

export default createAPI;
