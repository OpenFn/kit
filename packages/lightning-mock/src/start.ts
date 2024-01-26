import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger, { LogLevel } from '@openfn/logger';

import createLightningServer from './server';

type Args = {
  _: string[];
  port?: number;
  log?: LogLevel;
};

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a mock lighting server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: 8888,
  })
  .option('log', {
    alias: 'l',
    description: 'Log level',
    type: 'string',
    default: 'debug',
  })
  .parse() as Args;

const logger = createLogger('LNG', { level: args.log });

createLightningServer({
  port: args.port,
  logger,
  logLevel: args.log,
});

logger.success('Started mock Lightning server on ', args.port);
