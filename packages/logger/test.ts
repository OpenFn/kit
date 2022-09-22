import createLogger from './src/logger';

const logger = new createLogger('Test');

logger('should work')
logger.log('log message')
// logger.debug('trace message')
logger.error('OH NO')
logger.warn('careful now')
logger.log('a', 'b')
logger.info({ a: 1, b: 2 })


