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
  batch?: Record<string, boolean>;
  batchInterval?: number;
  batchLimit?: number;
  timeout_ms?: number;
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

/**
 * Queues engine events for sequential processing to Lightning with optional batching.
 *
 * Queuing ensures events are sent in order while allowing batching to reduce network calls.
 * Batching helps with high-volume logs by sending fewer requests with larger payloads,
 * reducing websocket latency. Events batch by count or time interval, whichever comes first.
 *
 * The basic architecture is:
 * - events are synchronously and immediately added to a queue
 * - items are processed sequentially
 * - after an item has been processed, we pull the next item from the queue
 *
 * If an event is flagged as batchable, we introduce new rules
 * - We flag if a batch is "open"
 * - A batch event will wait for the batch interval to expire before process () completes
 * - So batch will usually block the async loop until the batch has naturally expired
 * - The batch event can be interrupted early if a limit is hit, or a new event type comes in
 *
 * The batch exposes a danger of having two loops running async, so it's managed very carefully.
 * After a batch event is sent, in some cases, the batch will trigger next
 */
export function eventProcessor(
  engine: RuntimeEngine,
  context: Context,
  callbacks: Record<string, EventHandler>,
  options: EventProcessorOptions = {}
) {
  const { id: planId, logger } = context;
  const {
    batchLimit = DEFAULT_BATCH_LIMIT,
    batchInterval = DEFAULT_BATCH_INTERVAL,
    timeout_ms,
    events,
  } = options;

  const queue: any = [];

  let activeBatch: string | null | number = null;
  let batch: any = [];
  let batchTimeout: NodeJS.Timeout | null = null;
  let batchSendPromise: Promise<void> | null = null;
  let didFinish = false;
  let timeoutHandle: NodeJS.Timeout;

  const next = async () => {
    if (batchSendPromise) {
      await batchSendPromise;
    }
    const evt = queue[0];
    if (evt) {
      didFinish = false;

      const finish = () => {
        clearTimeout(timeoutHandle);
        if (!didFinish) {
          didFinish = true;
          queue.shift();
          setImmediate(next);
        }
      };

      if (timeout_ms) {
        timeoutHandle = setTimeout(() => {
          logger.error(`${planId} :: ${evt.name} :: timeout (fallback)`);
          finish();
        }, timeout_ms);
      }

      await process(evt.name, evt.event);
      console.log(`finish ${evt.name}`);
      finish();
    }
  };

  // If sending the batch early, we break the cycle of the main
  // process loop
  // So we need to control whether to trigger the next call,
  // or whether the calling function will process the next item for us
  // TODO: rename to exitEarly = false, and only early exists have to set this
  const sendBatch = async (triggerNext = false) => {
    if (activeBatch) {
      console.log('sending batch', activeBatch, batch.length);
      clearTimeout(batchTimeout!);
      batchTimeout = null;

      // first clear the batch
      const name = activeBatch;
      activeBatch = Infinity;
      await send(name, batch, batch.length);
      activeBatch = null;
      batch = [];

      if (triggerNext) {
        queue.shift();
        next();
      }
    }
  };

  const send = async (name: string, payload: any, batchSize?: number) => {
    try {
      const start = Date.now();
      // @ts-ignore
      const lightningEvent = eventMap[name] ?? name;
      await callbacks[name](context, payload);
      if (batchSize) {
        logger.info(
          `${planId} :: sent ${lightningEvent} (${batchSize}):: OK :: ${
            Date.now() - start
          }ms`
        );
      } else {
        logger.info(
          `${planId} :: sent ${lightningEvent} :: OK :: ${Date.now() - start}ms`
        );
      }
    } catch (e: any) {
      if (!e.reportedToSentry) {
        Sentry.captureException(e);
        logger.error(e);
      }
      // Do nothing else here: the error should have been handled
      // and life will go on
    }
  };

  const addToBatch = async (event: any) => {
    batch.push(event);

    if (batch.length >= batchLimit) {
      // If we're at the batch limit, return right away
      return sendBatch(true);
    }
  };

  const process = async (name: string, event: any) => {
    console.log('process', name);
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
      await addToBatch(event);
      return;
    }

    if (name in callbacks) {
      if (options?.batch?.[name]) {
        // batch mode is enabled!
        activeBatch = name;

        // First, push this event to the batch
        batch.push(event);

        // Next, peek ahead in the queue for more pending events
        while (queue.length > 1) {
          if (queue[1].name === name) {
            const [nextBatchItem] = queue.splice(1, 1);
            batch.push(nextBatchItem.event);

            if (batch.length >= batchLimit) {
              // If we're at the batch limit, return right away
              return sendBatch(true);
            }
          } else {
            // If there's another pending item not a part of this batch,
            // just send the batch now
            // send the batch early
            return sendBatch(true);
          }
        }

        if (!batchTimeout) {
          // finally wait for a time before sending the batch
          // This is the "natural" batch trigger
          return new Promise((resolve) => {
            batchTimeout = setTimeout(() => {
              sendBatch(false).then(resolve);
            }, batchInterval);
          });
        }
      } else {
        await send(name, event);
      }
    } else {
      logger.warn('no event bound for', name);
    }
  };

  const enqueue = (name: string, event: any) => {
    console.log('queue', name);
    if (name === 'workflow-log') {
      console.log(event.message);
    }
    queue.push({ name, event });

    if (queue.length == 1) {
      // If this is the only item in the queue, start executing right away
      console.log(`[${name}] executing immediately`);
      setImmediate(next);
    } else if (activeBatch === name) {
      addToBatch(event);
      queue.pop();
    } else if (queue.length == 2 && batchTimeout) {
      console.log('Sending batch early');
      // If this is the second item in the queue, and we have a batch active,
      // send the batch early
      // (note that this event will still be deferred)
      sendBatch(true);
    } else {
      console.log(`[${name}] deffering event`);
    }
  };

  const e = (events || allEngineEvents).reduce(
    (obj, e) => Object.assign(obj, { [e]: (p: any) => enqueue(e, p) }),
    {}
  );

  engine.listen(planId, e);

  // return debug state
  return { queue };
}
