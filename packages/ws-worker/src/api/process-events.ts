import * as Sentry from '@sentry/node';

import {
  JOB_COMPLETE,
  JOB_START,
  RuntimeEngine,
  WORKFLOW_COMPLETE,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from '@openfn/engine-multi';
import {
  RUN_COMPLETE,
  RUN_LOG,
  RUN_START,
  GET_DATACLIP,
  STEP_COMPLETE,
  STEP_START,
  GET_CREDENTIAL,
} from '../events';
import { Context } from './execute';

export type EventHandler = (context: any, event: any) => void;

const eventMap = {
  'workflow-start': RUN_START,
  'job-start': STEP_START,
  'job-complete': STEP_COMPLETE,
  'workflow-log': RUN_LOG,
  'workflow-complete': RUN_COMPLETE,
};

// this function will:
// - listen to all events from the engine
// - add them to a queue
// - process them one at a time
export function eventProcessor(
  engine: RuntimeEngine,
  context: Context,
  callbacks: Record<string, EventHandler>
) {
  const { id: planId, logger } = context;

  const queue: any = [];

  const next = async () => {
    const evt = queue.shift();
    if (evt) {
      await process(evt.name, evt.event);
    }
    next();
  };

  const process = async (name: string, event: any) => {
    if (name !== 'workflow-log') {
      Sentry.addBreadcrumb({
        category: 'event',
        message: name,
        level: 'info',
      });
    }

    if (name in callbacks) {
      const lightningEvent = eventMap[name] ?? name;
      try {
        let start = Date.now();

        await callbacks[name](context, event);
        logger.info(
          `${planId} :: sent ${lightningEvent} :: OK :: ${Date.now() - start}ms`
        );
      } catch (e: any) {
        if (!e.reportedToSentry) {
          Sentry.captureException(e);
          logger.error(e);
        }
        // Do nothing else here: the error should have been handled
        // and life will go on
      }
    } else {
      console.warn('no event bound for', name);
    }
  };

  const enqueue = (name: string, event: any) => {
    queue.push({ name, event });

    if (queue.length == 1) {
      next();
    }
  };

  const e = [
    WORKFLOW_START,
    WORKFLOW_COMPLETE,
    JOB_START,
    JOB_COMPLETE,
    WORKFLOW_LOG,
  ].reduce((obj, e) => Object.assign(obj, { [e]: enqueue }), {});

  engine.listen(planId, e);
}
