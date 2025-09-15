import v8 from 'node:v8';
import { Logger } from '@openfn/logger';

export const heap = (logger: Logger, label: string) => {
  const stats = v8.getHeapStatistics();
  const heap_mb = (stats.used_heap_size / (1024 * 1024)).toFixed(2);
  // logger.debug(
  //   `${new Array(indent).fill(' ').join('')}heap memory: ${heap_mb}`
  // );
  logger.debug(`[${label}] heap memory: ${heap_mb}`);
};
