import type { ExecutionPlan, Lazy, State, UUID } from '@openfn/lexicon';
import * as Sentry from '@sentry/node';
import type { RunLogPayload } from '@openfn/lexicon/lightning';
import type { Logger } from '@openfn/logger';
import type {
  RuntimeEngine,
  Resolvers,
  WorkerLogPayload,
} from '@openfn/engine-multi';

import { createRunState, timeInMicroseconds } from '../util';
import { RUN_LOG, GET_DATACLIP, GET_CREDENTIAL } from '../events';
import handleStepComplete from '../events/step-complete';
import handleStepStart from '../events/step-start';
import handleRunError from '../events/run-error';

import type { Channel, RunState } from '../types';
import { WorkerRunOptions } from '../util/convert-lightning-plan';
import { sendEvent } from '../util/send-event';
import { eventProcessor } from './process-events';

const enc = new TextDecoder('utf-8');

export { handleStepComplete, handleStepStart };

export type Context = {
  id: UUID; // plan id
  channel: Channel;
  state: RunState;
  logger: Logger;
  engine: RuntimeEngine;
  options: WorkerRunOptions;
  onFinish: (result: any) => void;

  // maybe its better for version numbers to be scribbled here as we go?
};

// mapping engine events to lightning events

// pass a web socket connected to the run channel
// this thing will do all the work
export function execute(
  channel: Channel,
  engine: RuntimeEngine,
  logger: Logger,
  plan: ExecutionPlan,
  input: Lazy<State>,
  options: WorkerRunOptions = {},
  onFinish = (_result: any) => {}
) {
  logger.info('executing ', plan.id);

  const state = createRunState(plan, input);

  const context: Context = {
    id: plan.id!,
    channel,
    state,
    logger,
    engine,
    options,
    onFinish,
  };

  // Ensure that each execute call is in its own sentry isolated scope
  // Because I don't trust it to automatically scope each request properly
  Sentry.withIsolationScope(async () => {
    Sentry.addBreadcrumb({
      category: 'run',
      message: 'Executing run: loading metadata',
      level: 'info',
      data: {
        runId: plan.id,
      },
    });

    eventProcessor(engine, context, plan.id);

    const resolvers = {
      credential: (id: string) => loadCredential(context, id),

      // TODO not supported right now
      // dataclip: (id: string) => loadDataclip(channel, id),
    } as Resolvers;

    setTimeout(async () => {
      let loadedInput = input;

      // Optionally resolve initial state
      // TODO we need to remove this from here and let the runtime take care of it through
      // the resolver. See https://github.com/OpenFn/kit/issues/403
      // TODO come back and work out how initial state will work
      if (typeof input === 'string') {
        logger.debug('loading dataclip', input);

        try {
          loadedInput = await loadDataclip(context, input);
          logger.success('dataclip loaded');
        } catch (e: any) {
          return handleRunError(context, {
            workflowId: plan.id!,
            message: `Failed to load dataclip ${input}${
              e.message ? `: ${e.message}` : ''
            }`,
            type: 'DataClipError',
            severity: 'exception',
          });
        }
      }

      try {
        Sentry.addBreadcrumb({
          category: 'run',
          message: 'run metadata loaded: starting run',
          level: 'info',
          data: {
            runId: plan.id,
          },
        });
        // updateSentryStatus('started');
        engine.execute(plan, loadedInput as State, { resolvers, ...options });
      } catch (e: any) {
        Sentry.addBreadcrumb({
          category: 'run',
          message: 'exception in run',
          level: 'info',
          data: {
            runId: plan.id,
          },
        });
        handleRunError(context, {
          workflowId: plan.id!,
          message: e.message,
          type: e.type,
          severity: e.severity,
        });
      }
    });
  });
  return context;
}

// async/await wrapper to push to a channel
// TODO move into utils I think?

// TODO move all event handlers into api/events/*

// Called on job fail or crash
// If this was a crash, it'll also trigger a workflow error
// But first we update the reason for this failed job
export function onJobError(context: Context, event: any) {
  // Error is the same as complete, but we might report
  // a different complete reason

  // awkward error handling
  // If the error is written to state, it's a fail,
  // and we don't want to send that to handleStepComplete
  // because it'll count it as a crash
  // This isn't very good: maybe we shouldn't trigger an error
  // at all for a fail state?
  const { state, error, jobId } = event;
  // This test is horrible too
  if (state?.errors?.[jobId]?.message === error.message) {
    return handleStepComplete(context, event);
  } else {
    return handleStepComplete(context, event, event.error);
  }
}

export function onJobLog(
  context: Context,
  event: Omit<WorkerLogPayload, 'workflowId'>
) {
  const { state, options } = context;
  let message = event.message as any[];

  if (event.redacted) {
    message = [
      `(Log message redacted: exceeds ${options.payloadLimitMb}mb memory limit)`,
    ];
  } else if (typeof event.message === 'string') {
    message = JSON.parse(event.message);
  }
  // lightning-friendly log object
  const log: RunLogPayload = {
    run_id: `${state.plan.id}`,
    message,
    source: event.name,
    level: event.level,
    // @ts-ignore
    timestamp: timeInMicroseconds(event.time) as string,
  };

  if (state.activeStep) {
    log.step_id = state.activeStep;
  }

  return sendEvent<RunLogPayload>(context, RUN_LOG, log);
}

export async function loadDataclip(
  context: Pick<Context, 'logger' | 'channel' | 'id' | 'options'>,
  stateId: string
) {
  const result = await sendEvent<Uint8Array>(context, GET_DATACLIP, {
    id: stateId,
  });
  const str = enc.decode(new Uint8Array(result));
  return JSON.parse(str);
}

export async function loadCredential(
  context: Pick<Context, 'logger' | 'channel' | 'id' | 'options'>,
  credentialId: string
) {
  return sendEvent(context, GET_CREDENTIAL, { id: credentialId });
}
