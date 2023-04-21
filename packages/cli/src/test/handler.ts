import { createNullLogger, Logger } from '../util/logger';
import compile from '../compile/compile';
import loadState from '../util/load-state';
import execute from '../execute/execute';
import { ExecuteOptions } from '../execute/command';

const testHandler = async (options: ExecuteOptions, logger: Logger) => {
  logger.log('Running test job...');

  // Preconfigure some options
  options.compile = true;
  options.adaptors = [];

  options.workflow = {
    start: 'start',
    jobs: [
      {
        id: 'start',
        data: { defaultAnswer: 42 },
        expression:
          "const fn = () => (state) => { console.log('Starting computer...'); return state; }; fn()",
        next: {
          calculate: '!state.error',
        },
      },
      {
        id: 'calculate',
        expression:
          "const fn = () => (state) => { console.log('Calculating to life, the universe, and everything..'); return state }; fn()",
        next: {
          result: true,
        },
      },
      {
        id: 'result',
        expression:
          'const fn = () => (state) => ({ data: { answer: state.data.answer || state.data.defaultAnswer } }); fn()',
      },
    ],
  };

  logger.break();
  logger.info('Workflow object:');
  logger.info(JSON.stringify(options.workflow, null, 2));
  logger.break();

  if (!options.stateStdin) {
    logger.debug(
      'No state provided: pass an object with state.data.answer to provide custom input'
    );
    logger.debug('eg: -S "{ "data": { "answer": 33 }  }"');
  }

  const silentLogger = createNullLogger();

  const state = await loadState(options, silentLogger);
  const code = await compile(options, logger);
  const result = await execute(code, state, options);
  logger.success(`Result: ${result.data.answer}`);
  return result;
};

export default testHandler;
