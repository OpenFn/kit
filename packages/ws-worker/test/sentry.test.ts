/*
 * Testing various sentry integrations
 */

import test from 'ava';
import { mockChannel } from '../src/mock/sockets';

import type {
  LightningPlan,
  RunCompletePayload,
} from '@openfn/lexicon/lightning';
import createLightningServer, {
  generateKeys,
  toBase64,
} from '@openfn/lightning-mock';

import { createRun, createEdge, createJob, sleep } from './util';
import createWorkerServer from '../src/server';
import * as e from '../src/events';
import createMockRTE from '../src/mock/runtime-engine';
import { ExecutionPlan } from '@openfn/lexicon';
import { STEP_START } from '../src/events';
import onRunStart from '../src/events/run-start';
import onStepStart from '../src/events/step-start';
import { createRunState } from '../src/util';

// let lng: ReturnType<typeof createLightningServer>;
// let worker: ReturnType<typeof createWorkerServer>;

// let keys = { private: '.', public: '.' };

// const urls = {
//   worker: 'http://localhost:4567',
//   lng: 'ws://localhost:7654/worker',
// };

// const execute = async (plan: ExecutionPlan, input = {}, options = {}) =>
//   new Promise<{ reason: ExitReason; state: any }>((done) => {
//     // TODO allow handlers to be passed
//     const channel = mockChannel({
//       [RUN_START]: async () => true,
//       [STEP_START]: async () => true,
//       [RUN_LOG]: async () => true,
//       [STEP_COMPLETE]: async () => true,
//       [RUN_COMPLETE]: async () => true,
//       [GET_CREDENTIAL]: async () => true,
//     });

//     const onFinish = (result: any) => {
//       done(result);
//     };

//     doExecute(channel, engine, logger, plan, input, options, onFinish);
//   });

// let rollingRunId = 1;
// const getRun = (): LightningPlan =>
//   ({
//     id: `a${++rollingRunId}`,
//     jobs: [
//       {
//         body: 'fn(s => s)',
//       },
//     ],
//   } as LightningPlan);

// test.before(async () => {
//   keys = await generateKeys();

//   const engine = await createMockRTE();
//   lng = createLightningServer({
//     port: 7654,
//   });

//   worker = createWorkerServer(engine, {
//     port: 4567,
//     lightning: urls.lng,
//     maxWorkflows: 1,
//     runPublicKey: keys.public,
//     backoff: {
//       min: 1,
//       max: 1000,
//     },
//   });
// });

// test.afterEach(() => {
//   lng.removeAllListeners();
// });

test.serial('should report an error on step:start', (t) => {
  // trigger a step:complete event

  // And I want lightning to reject it
  const channel = mockChannel({
    [STEP_START]: () => {
      console.log(' STEP START ');
      throw new Error('fail');
    },
    // no event handler is registered, so the mock will throw a timeout
  });

  // don't run a whole run
  const context = {
    channel,
    state: createRunState({}),
  };

  // so this doesn't help because the handler itself doesn' call sentry
  // the wrapper takes care of that
  // 1) I could move error handling into sendEvent
  //   but that only captures lighting error respones
  //   it won't track a general exception
  // 2) it is nice to test this stuff in isolation
  onStepStart(context, {
    jobId: 'blah',
  });
});
