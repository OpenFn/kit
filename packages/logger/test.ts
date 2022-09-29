import createLogger, { DEBUG } from './src/logger';

const logger = createLogger('Test', { level: DEBUG });

logger('log')
logger.debug('debug')
// logger.trace('trace')
logger.success('success')
logger.info('info')
logger.warn('warning')
logger.error('error')
logger.info({ a: 1, b: 2 })


