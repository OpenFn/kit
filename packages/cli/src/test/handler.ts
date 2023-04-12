import { createNullLogger, Logger } from '../util/logger';
import compile from '../compile/compile';
import loadState from '../util/load-state';
import execute from '../execute/execute';
import { ExecuteOptions } from '../execute/command';

const sillyMessage =
  'Calculating the answer to life, the universe, and everything...';

// TODO something strange has happened to test
// Come back and fix it
const testHandler = async (options: ExecuteOptions, logger: Logger) => {
  logger.log('Running test job...');

  options.compile = true;
  options.job = `
  const fn = (fn) => fn;
  fn((state) => {
    state.data.count += state.data.count
    return state;
  })
`;
  // delete options.jobPath;

  logger.info(sillyMessage);
  if (!options.stateStdin) {
    logger.debug(
      'No state provided: pass an object with state.data.count to provide custom input'
    );
    options.stateStdin = '{ "data": { "count": 21 } }';
  }

  const silentLogger = createNullLogger();

  const state = await loadState(options, silentLogger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);
  logger.success(`Result: ${result.data.count}`);
  return result;
};

export default testHandler;
