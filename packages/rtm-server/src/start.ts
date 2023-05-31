// start the server in a local CLI
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger from '@openfn/logger';

import createRTM from '@openfn/runtime-manager';
import createRTMServer from './server';

type Args = {
  _: string[];
  port?: number;
  lightning?: string;
};

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a runtime manager server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: 2222,
  })
  .option('lightning', {
    alias: 'l',
    description: 'Base url to Lightning',
  })
  .parse() as Args;

const rtm = createRTM();
console.log('RTM created');

// TODO why is this blowing up??
const logger = createLogger('SRV');

createRTMServer(rtm, {
  port: args.port,
  lightning: args.lightning,
  logger,
});
