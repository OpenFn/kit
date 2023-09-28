import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger from '@openfn/logger';

import createLightningServer from './server';

type Args = {
  _: string[];
  port?: number;
};

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a runtime manager server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: 8888,
  })
  .parse() as Args;

const logger = createLogger('LNG', { level: 'debug' });

createLightningServer({
  port: args.port,
  logger,
});

logger.success('Started mock Lightning server on ', args.port);
