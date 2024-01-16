// Creates the public/external API to the runtime
// Basically a thin wrapper, with validation, around the engine

import createLogger from '@openfn/logger';

import whitelist from './whitelist';
import createEngine, { EngineOptions } from './engine';

import pkg from '../package.json' assert { type: 'json' };

import type { RuntimeEngine } from './types';

export type State = any; // TODO I want a nice state def with generics

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credential?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

export type RTEOptions = Partial<
  Omit<EngineOptions, 'whitelist' | 'noCompile'> & {
    // Needed here for unit tests to support json expressions. Would rather exclude tbh
    compile?: {
      skip?: boolean;
    };
  }
>;

const DEFAULT_REPO_DIR = '/tmp/openfn/worker/repo';

const DEFAULT_MEMORY_LIMIT = 500;

// Create the engine and handle user-facing stuff, like options parsing
// and defaulting
const createAPI = async function (
  options: RTEOptions = {}
): Promise<RuntimeEngine> {
  let { repoDir } = options;

  const logger = options.logger || createLogger('RTE', { level: 'debug' });

  if (!repoDir) {
    repoDir = DEFAULT_REPO_DIR;
    logger.warn('Using default repo directory: ', DEFAULT_REPO_DIR);
  }
  logger.info('repoDir set to ', repoDir);

  const engineOptions = {
    logger,

    // TODO should resolvers be set here on passed to execute?
    // They do feel more "global"
    // resolvers: options.resolvers, // TODO should probably default these?
    repoDir,
    // Only allow @openfn/ modules to be imported into runs
    whitelist,

    // TODO should map this down into compile.
    noCompile: options.compile?.skip ?? false,
    // TODO should we disable autoinstall overrides?
    autoinstall: options.autoinstall,

    maxWorkers: options.maxWorkers,
    memoryLimitMb: options.memoryLimitMb || DEFAULT_MEMORY_LIMIT,

    statePropsToRemove: options.statePropsToRemove ?? [
      'configuration',
      'response',
    ],
  };

  logger.info(`memory limit set to ${options.memoryLimitMb}mb`);
  logger.info(`statePropsToRemove set to: `, engineOptions.statePropsToRemove);

  const engine = await createEngine(engineOptions);

  return {
    options: engineOptions,
    version: pkg.version,
    execute: engine.execute,
    listen: engine.listen,
    destroy: engine.destroy,
    on: (evt: string, fn: (...args: any[]) => void) => engine.on(evt, fn),
  };
};

export default createAPI;
