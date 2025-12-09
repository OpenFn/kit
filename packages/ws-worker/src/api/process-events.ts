import * as Sentry from '@sentry/node';

import {
  JOB_COMPLETE,
  JOB_ERROR,
  JOB_START,
  RuntimeEngine,
  WORKFLOW_COMPLETE,
  WORKFLOW_ERROR,
  WORKFLOW_LOG,
  WORKFLOW_START,
} from '@openfn/engine-multi';
import {
  RUN_COMPLETE,
  RUN_LOG,
  RUN_START,
  STEP_COMPLETE,
  STEP_START,
} from '../events';
import { Context } from './execute';

export type EventHandler = (context: any, event: any) => void;

const eventMap = {
  [WORKFLOW_START]: RUN_START,
  [JOB_START]: STEP_START,
  [JOB_COMPLETE]: STEP_COMPLETE,
  [WORKFLOW_LOG]: RUN_LOG,
  [WORKFLOW_COMPLETE]: RUN_COMPLETE,
};

const allEngineEvents = [
  WORKFLOW_START,
  WORKFLOW_COMPLETE,
  JOB_START,
  JOB_COMPLETE,
  WORKFLOW_LOG,
  JOB_ERROR,
  WORKFLOW_ERROR,
];

// argument says which events can be batched
// batched events will call the callback with an array
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
      next(); // TODO maybe next tick?
    }
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
      // @ts-ignore
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
      logger.warn('no event bound for', name);
    }
  };

  const enqueue = (name: string, event: any) => {
    queue.push({ name, event });

    if (queue.length == 1) {
      next();
    }
  };

  const e = allEngineEvents.reduce(
    (obj, e) => Object.assign(obj, { [e]: (p: any) => enqueue(e, p) }),
    {}
  );

  engine.listen(planId, e);
}
