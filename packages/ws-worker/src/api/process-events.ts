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

export type EventProcessorOptions = {
  batch?: Record<string, true>;
  batchInterval?: number;
  batchLimit?: number;
};

const DEFAULT_BATCH_LIMIT = 10;
const DEFAULT_BATCH_INTERVAL = 10;

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
  callbacks: Record<string, EventHandler>,
  options: EventProcessorOptions = {}
) {
  const { id: planId, logger } = context;
  const {
    batchLimit: limit = DEFAULT_BATCH_LIMIT,
    batchInterval: interval = DEFAULT_BATCH_INTERVAL,
  } = options;

  const queue: any = [];

  const next = async () => {
    const evt = queue[0];
    if (evt) {
      await process(evt.name, evt.event);
      queue.shift(); // keep the event on the queue until processing is finished
      // setImmediate(next);
      next();
    }
  };

  let activeBatch: string | null = null;
  let batch: any = [];
  let start: number = -1;
  let batchTimeout: NodeJS.Timeout;

  const sendBatch = async (name: string) => {
    clearTimeout(batchTimeout);
    // first clear the batch
    activeBatch = null;
    await send(name, batch);
    batch = [];
  };

  const send = async (name: string, payload: any) => {
    // @ts-ignore
    const lightningEvent = eventMap[name] ?? name;
    await callbacks[name](context, payload);
    logger.info(
      `${planId} :: sent ${lightningEvent} :: OK :: ${Date.now() - start}ms`
    );
  };

  const process = async (name: string, event: any) => {
    // TODO this actually shouldn't be here - should be done separately
    if (name !== 'workflow-log') {
      Sentry.addBreadcrumb({
        category: 'event',
        message: name,
        level: 'info',
      });
    }

    if (name === activeBatch) {
      // if there's a batch open, just push the event
      batch.push(event);

      if (batch.length >= limit) {
        await sendBatch(name);
      }
      return;
    } else if (activeBatch) {
      // If a different event comes in, send the batch (and carry on processing the event)
      await sendBatch(activeBatch);
    }

    if (name in callbacks) {
      try {
        start = Date.now();

        if (options?.batch?.[name]) {
          // batch mode is enabled!
          activeBatch = name;

          // First, push this event to the batch
          batch.push(event);

          // Next, peek ahead in the queue for more pending events
          while (queue.length > 1 && queue[1].name === name) {
            const [nextBatchItem] = queue.splice(1, 1);
            batch.push(nextBatchItem.event);

            if (batch.length >= limit) {
              // If we're at the batch limit, return right away
              return sendBatch(name);
            }
          }

          // finally wait for a time before sending the batch
          if (!batchTimeout) {
            const batchName = activeBatch!;
            batchTimeout = setTimeout(async () => {
              sendBatch(batchName);
            }, interval);
          }
          return;
        }

        await send(name, event);
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
