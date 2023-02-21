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
  options.jobSource = `const fn = () => state => { console.log('${sillyMessage}'); return state * 2; } ; fn()`;
  delete options.jobPath;

  if (!options.stateStdin) {
    logger.debug('No state provided: try -S <number> to provide some state');
    options.stateStdin = '21';
  }

  const silentLogger = createNullLogger();

  const state = await loadState(options, silentLogger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);
  logger.success(`Result: ${result}`);
  return result;
};

export default testHandler;
