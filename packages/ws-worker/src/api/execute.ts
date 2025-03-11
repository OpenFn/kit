import type { ExecutionPlan, Lazy, State } from '@openfn/lexicon';
import * as Sentry from '@sentry/node';
import type { RunLogPayload } from '@openfn/lexicon/lightning';
import type { Logger } from '@openfn/logger';
import type {
  RuntimeEngine,
  Resolvers,
  WorkerLogPayload,
  JobStartPayload,
} from '@openfn/engine-multi';

import {
  getWithReply,
  createRunState,
  throttle as createThrottle,
  timeInMicroseconds,
} from '../util';
import {
  RUN_COMPLETE,
  RUN_LOG,
  RUN_START,
  GET_DATACLIP,
  STEP_COMPLETE,
  STEP_START,
  GET_CREDENTIAL,
} from '../events';
import handleRunStart from '../events/run-start';
import handleStepComplete from '../events/step-complete';
import handleStepStart from '../events/step-start';
import handleRunComplete from '../events/run-complete';
import handleRunError from '../events/run-error';

import type { Channel, RunState } from '../types';
import { WorkerRunOptions } from '../util/convert-lightning-plan';

const enc = new TextDecoder('utf-8');

class LightningSocketError extends Error {
  name = 'LightningSocketError';
  event = '';
  rejectMessage = '';
  constructor(event: string, message: string) {
    super(`[${event}] ${message}`);
    this.event = event;
    this.rejectMessage = message;
  }
}

class LightningTimeoutError extends Error {
  name = 'LightningTimeoutError';
  constructor(event: string) {
    super(event);
    super(`[${event}] timeout`);
  }
}

export { handleStepComplete, handleStepStart };

export type Context = {
  channel: Channel;
  state: RunState;
  logger: Logger;
  engine: RuntimeEngine;
  options: WorkerRunOptions;
  onFinish: (result: any) => void;

  // maybe its better for version numbers to be scribbled here as we go?
};

// mapping engine events to lightning events
const eventMap = {
  'workflow-start': RUN_START,
  'job-start': STEP_START,
  'job-complete': STEP_COMPLETE,
  'workflow-log': RUN_LOG,
  'workflow-complete': RUN_COMPLETE,
};

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
  // return Sentry.withIsolationScope(async () => {
  logger.info('executing ', plan.id);

  // const sentryContext = {
  //   run_id: plan.id,
  //   // status: 'setup', // | 'started' | 'finished',
  //   // last_event: '', // what was the last event emitted by this run?
  //   // step: '', // what step is this run on?
  // };

  // Sentry.setContext('run', {
  //   run_id: plan.id,
  // });

  // const updateSentryStatus = (status: 'setup' | 'started' | 'finished') => {
  //   sentryContext.status = status;
  //   Sentry.setContext('run', sentryContext);
  // };

  // TODO step name isn;t supported in the payload yet
  // so maybe we'll add this later
  // const updateSentryStep = (step: string) => {
  //   Sentry.setContext('run', {
  //     step,
  //   });
  // };

  // this doesn't work great because the last event on context
  // is not neccessarily the same as the last event on an error
  // like you might get an error but then the context will change before its reported
  // const updateSentryEvent = (event: string) => {
  //   sentryContext.last_event = event;
  //   Sentry.setContext('run', sentryContext);
  // };

  Sentry.addBreadcrumb({
    category: 'run',
    message: 'Executing run: loading metadata',
    level: 'info',
    data: {
      runId: plan.id,
    },
  });

  const state = createRunState(plan, input);

  const context: Context = {
    channel,
    state,
    logger,
    engine,
    options,
    onFinish,
  };

  const throttle = createThrottle();

  type EventHandler = (context: any, event: any) => void;

  // Utility function to:
  // a) bind an event handler to a runtime-engine event
  // b) pass the context object into the hander
  // c) log the response from the websocket from lightning
  // TODO for debugging and monitoring, we should also send events to the worker's event emitter
  const addEvent = (eventName: string, handler: EventHandler) => {
    const wrappedFn = async (event: any) => {
      if (eventName !== 'workflow-log') {
        Sentry.addBreadcrumb({
          category: 'event',
          message: eventName,
          level: 'info',
        });
      }

      // TODO this logging is in the wrong place
      // This actually logs errors coming out of the worker
      // But it presents as logging from messages being send to lightning
      // really this messaging should move into send event

      // @ts-ignore
      const lightningEvent = eventMap[eventName] ?? eventName;
      try {
        // updateSentryEvent(eventName);
        await handler(context, event);
        logger.info(`${plan.id} :: ${lightningEvent} :: OK`);
      } catch (e: any) {
        const context = {
          run_id: plan.id,
          event: eventName,
        };
        const extras: any = {};
        if (e instanceof LightningSocketError) {
          extras.details =
            'This error was thrown because Lightning rejected an event from the worker';
          extras.rejection_reason = e.rejectMessage;
        }
        Sentry.captureException(e, (scope) => {
          scope.setContext('run', context);
          scope.setExtras(extras);
          return scope;
        });
        logger.error(
          `${plan.id} :: ${lightningEvent} :: ERR: ${e.message || e.toString()}`
        );
        // TODO I don't think I want a stack trace here in prod?
        // logger.error(e);
      }
    };
    return {
      [eventName]: wrappedFn,
    };
  };

  // TODO listeners need to be called in a strict queue
  // so that they send in order
  const listeners = Object.assign(
    {},
    addEvent('workflow-start', throttle(handleRunStart)),
    addEvent('job-start', throttle(handleStepStart)),
    addEvent('job-complete', throttle(handleStepComplete)),
    addEvent('job-error', throttle(onJobError)),
    addEvent('workflow-log', throttle(onJobLog)),
    // This will also resolve the promise
    addEvent(
      'workflow-complete',
      throttle((context, evt) => {
        // updateSentryStatus('finished');
        return handleRunComplete(context, evt);
      })
    ),

    addEvent(
      'workflow-error',
      throttle((context, evt) => {
        // updateSentryStatus('finished');
        return handleRunError(context, evt);
      })
    )

    // TODO send autoinstall logs
  );
  engine.listen(plan.id!, listeners);

  const resolvers = {
    credential: (id: string) => loadCredential(channel, id),

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
        loadedInput = await loadDataclip(channel, input);
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
  return context;
  // });
}

// async/await wrapper to push to a channel
// TODO move into utils I think?
export const sendEvent = <T>(channel: Channel, event: string, payload?: any) =>
  new Promise((resolve, reject) => {
    channel
      .push<T>(event, payload)
      .receive('error', (message) => {
        reject(new LightningSocketError(event, message));
      })
      .receive('timeout', () => {
        reject(new LightningTimeoutError(event));
      })
      .receive('ok', resolve);
  });

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
  { channel, state, options }: Context,
  event: Omit<WorkerLogPayload, 'workflowId'>
) {
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
    run_id: state.plan.id!,
    message,
    source: event.name,
    level: event.level,
    // @ts-ignore
    timestamp: timeInMicroseconds(event.time) as string,
  };

  if (state.activeStep) {
    log.step_id = state.activeStep;
  }

  return sendEvent<RunLogPayload>(channel, RUN_LOG, log);
}

export async function loadDataclip(channel: Channel, stateId: string) {
  const result = await getWithReply<Uint8Array>(channel, GET_DATACLIP, {
    id: stateId,
  });
  const str = enc.decode(new Uint8Array(result));
  return JSON.parse(str);
}

export async function loadCredential(channel: Channel, credentialId: string) {
  return getWithReply(channel, GET_CREDENTIAL, { id: credentialId });
}
