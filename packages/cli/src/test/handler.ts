import { createNullLogger, Logger } from '../util/logger';
import compile from '../compile/compile';
import loadState from '../execute/load-state';
import execute from '../execute/execute';
import { CompilerOpts } from '../compile/compile';

const sillyMessage =
  'Calculating the answer to life, the universe, and everything...';

const testHandler = async (options: CompilerOpts, logger: Logger) => {
  logger.log('Running test job...');

  options.compile = true;
  options.jobSource = `
  const fn = (fn) => fn;
  fn((state) => {
    state.data.count += state.data.count
    return state;
  })
`;
  delete options.jobPath;

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
