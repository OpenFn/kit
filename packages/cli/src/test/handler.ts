import { createNullLogger, Logger } from '../util/logger';
import compile from '../compile/compile';
import loadState from '../execute/load-state';
import execute from '../execute/execute';
import { SafeOpts } from '../commands';

const sillyMessage = 'Calculating the answer to life, the universe, and eveything...';

const testHandler = async (options: SafeOpts, logger: Logger) => {
  logger.log('Running test job...');

  // cheating a bit on pathing with this secret option
  // @ts-ignore
  options.jobSource = `const fn = () => state => { console.log('${sillyMessage}'); return state * 2; } ; fn()`;
  // @ts-ignore
  delete options.jobPath;

  if (!options.stateStdin) {
    logger.debug('No state provided: use -S <number> to provide some state');
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
