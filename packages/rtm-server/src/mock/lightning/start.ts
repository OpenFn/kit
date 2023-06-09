import createLightningServer from './server';
import createLogger from '@openfn/logger';

const port = '8888';

const logger = createLogger('LNG', { level: 'debug' });

createLightningServer({
  port,
  logger,
});

logger.success('Started mock Lightning server on ', port);
