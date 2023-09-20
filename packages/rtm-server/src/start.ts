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
  repoDir?: string;
};

const logger = createLogger('SRV', { level: 'info' });

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
    description:
      'Base url to Lightning, eg, http://localhost:1234. Set to "mock" to use the default mock server',
  })
  .option('repo-dir', {
    alias: 'd',
    description: 'Path to the runtime repo (where modules will be installed)',
  })
  .parse() as Args;

if (args.lightning === 'mock') {
  args.lightning = 'http://localhost:8888';
}

// TODO the rtm needs to take callbacks to load credential, and load state
// these in turn should utilise the websocket
// So either the server creates the runtime (which seems reasonable acutally?)
// Or the server calls a setCalbacks({ credential, state }) function on the RTM
// Each of these takes the attemptId as the firsdt argument
// credential and state will lookup the right channel
const rtm = createRTM('rtm', { repoDir: args.repoDir });
logger.debug('RTM created');

createRTMServer(rtm, {
  port: args.port,
  lightning: args.lightning,
  logger,
});
