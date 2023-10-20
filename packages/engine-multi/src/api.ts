// Creates the public/external API to the runtime
// Basically a thin wrapper, with validation, around the engine

import createLogger from '@openfn/logger';

import whitelist from './whitelist';
import createEngine, { EngineOptions } from './engine';

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

// Create the engine and handle user-facing stuff, like options parsing
// and defaulting
const createAPI = async function (options: RTEOptions = {}) {
  let { repoDir } = options;

  const logger = options.logger || createLogger('RTE', { level: 'debug' });

  if (!repoDir) {
    if (process.env.ENGINE_REPO_DIR) {
      repoDir = process.env.ENGINE_REPO_DIR;
    } else {
      repoDir = '/tmp/openfn/repo';
      logger.warn('Using default repodir');
      logger.warn('Set env var ENGINE_REPO_DIR to use a different directory');
    }
  }

  // re logging, for example, where does this go?
  // it's not an attempt log
  // it probably shouldnt be sent to the worker
  // but it is an important bit of debugging
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

    minWorkers: options.minWorkers,
    maxWorkers: options.maxWorkers,
  };

  // Note that the engine here always uses the standard worker, the real one
  // To use a mock, create the engine directly
  const engine = await createEngine(engineOptions);

  // Return the external API
  return {
    execute: engine.execute,
    listen: engine.listen,
  };
};

export default createAPI;
