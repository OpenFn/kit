import { TestOptions } from './command';
import { createNullLogger, Logger } from '../util/logger';
import loadState from '../util/load-state';
import compile from '../compile/compile';
import execute from '../execute/execute';
import { ExecuteOptions } from '../execute/command';

const testHandler = async (options: TestOptions, logger: Logger) => {
  logger.log('Running test job...');
  const opts: Partial<ExecuteOptions> = { ...options };

  // Preconfigure some options
  opts.compile = true;
  opts.adaptors = [];

  opts.workflow = {
    start: 'start',
    jobs: [
      {
        id: 'start',
        state: { data: { defaultAnswer: 42 } },
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
  logger.info(JSON.stringify(opts.workflow, null, 2));
  logger.break();

  if (!opts.stateStdin) {
    logger.debug(
      'No state provided: pass an object with state.data.answer to provide custom input'
    );
    logger.debug('eg: -S "{ "data": { "answer": 33 }  }"');
  }

  const state = await loadState(opts, createNullLogger());
  const code = await compile(opts, logger);
  const result = await execute(code!, state, opts as ExecuteOptions);
  logger.success(`Result: ${result.data.answer}`);
  return result;
};

export default testHandler;
