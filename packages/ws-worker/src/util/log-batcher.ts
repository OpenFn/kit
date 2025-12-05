import { UUID } from '@openfn/lexicon';
import { Logger } from '@openfn/logger';

type BatchCallback<T> = (events: T[]) => Promise<any>;

type LogBatcherOptions = {
  timeoutMs?: number;
  logger?: Logger;
  id?: UUID;
};

/**
 * Creates a batching function that collects items over a time window
 * and sends them in batches.
 *
 * When an item is added:
 * - It's added to the buffer
 * - A timer is started (if not already running)
 * - When the timer expires, all buffered items are flushed via the callback
 *
 * @param callback - Function to call with the batched items
 * @param options - Configuration options
 * @returns A function that accepts single items and batches them
 */
const createLogBatcher = <T>(
  callback: BatchCallback<T>,
  options: LogBatcherOptions = {}
) => {
  const { timeoutMs = 10, logger, id } = options;

  let buffer: T[] = [];
  let timer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }

    // Copy items and clear buffer
    // We copy the array so callback gets a stable reference
    // while buffer can continue to accumulate new items
    const itemsToSend = buffer.slice();
    buffer.length = 0;
    timer = null;

    if (logger) {
      logger.debug(`${id} batched ${itemsToSend.length} logs`);
    }

    // Send the batch (don't await - let it complete in the background)
    // The throttle wrapper in execute.ts handles sequential processing
    callback(itemsToSend);
  };

  const wrappedEventHandler = (_context: any, item: T) => {
    // Add item to buffer
    buffer.push(item);

    // Start timer if not already running
    if (!timer) {
      timer = setTimeout(() => {
        flush();
      }, timeoutMs);
    }

    return Promise.resolve();
  };

  return wrappedEventHandler;
};

export default createLogBatcher;
