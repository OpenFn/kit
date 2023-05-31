// start the server in a local CLI
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import createLogger from '@openfn/logger';

import createMockRTM from './mock/runtime-manager';
import createRTMServer from './server';

const args = yargs(hideBin(process.argv))
  .command('server', 'Start a runtime manager server')
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    default: 2222,
  })
  .option('lightning', {
    alias: 'l',
    description: 'Base url to Lightning',
  })
  .parse();

const rtm = createMockRTM('rtm');

// TODO why is this blowing up??
// const logger = createLogger('SRV');

createRTMServer(rtm, {
  port: args.port,
  lightning: args.lightning,
  // logger,
});
