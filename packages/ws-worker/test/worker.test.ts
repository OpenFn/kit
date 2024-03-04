// general tests against the worker

import test from 'ava';
import createRTE from '@openfn/engine-multi';
import { createMockLogger } from '@openfn/logger';

import type { ExitReason } from '@openfn/lexicon/lightning';

import { createPlan } from './util';
import { execute as doExecute } from '../src/api/execute';
import { mockChannel } from '../src/mock/sockets';
import {
  STEP_START,
  STEP_COMPLETE,
  RUN_LOG,
  RUN_START,
  RUN_COMPLETE,
  GET_CREDENTIAL,
} from '../src/events';
import { ExecutionPlan } from '@openfn/lexicon';

let engine: any;
let logger: any;

test.before(async () => {
  logger = createMockLogger();
  // logger = createLogger(null, { level: 'debug' });

  // Note: this is the REAL engine, not a mock
  engine = await createRTE({
    maxWorkers: 1,
    logger,
  });
});

test.after(async () => engine.destroy());

// Run code on the worker with a fake channel, no lightning
const execute = async (plan: ExecutionPlan, input = {}, options = {}) =>
  new Promise<{ reason: ExitReason; state: any }>((done) => {
    // TODO allow handlers to be passed
    const channel = mockChannel({
      [RUN_START]: async () => true,
      [STEP_START]: async () => true,
      [RUN_LOG]: async (_evt) => {
        //console.log(evt.source, evt.message)
        return true
      },
      [STEP_COMPLETE]: async () => true,
      [RUN_COMPLETE]: async () => true,
      [GET_CREDENTIAL]: async () => {
        throw new Error('err');
      },
    });

    const onFinish = (result: any) => {
      done(result);
    };

    doExecute(channel, engine, logger, plan, input, options, onFinish);
  });


// Repro for https://github.com/OpenFn/kit/issues/616
// This will not run in CI unless the env is set
if (process.env.OPENFN_TEST_SF_TOKEN && process.env.OPENFN_TEST_SF_PASSWORD) {
  // hard skipping the test because the insert actually fails (permissions)
  test.skip('salesforce issue', async (t) => {
    const plan = createPlan({
      id: 'x',
      expression: `bulk(
          'Contact',
          'insert',
          {
            failOnError: true,
            allowNoOp: true,
          },
          state => ([{
            "name": "testy mctestface",
            "email": "test@test.com"
          }])
        )`,
      adaptor: '@openfn/language-salesforce@4.5.0',
      configuration: {
        username: 'demo@openfn.org',
        securityToken: process.env.OPENFN_TEST_SF_TOKEN,
        password: process.env.OPENFN_TEST_SF_PASSWORD,
        loginUrl: 'https://login.salesforce.com',
      }
    });

    const input = { data: { result: 42 } };

    const result= await execute(plan, input);
    t.log(result)

    // Actually this fails right but it's a permissions thing on the sandbox
    t.is(result.reason.reason, 'success');
  })
}