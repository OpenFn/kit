import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure, override } from '../util/command-builders';
import { STAGING_URL } from './util';

export type ApolloOptions = Pick<
  Opts,
  'stateStdin' | 'log' | 'logJson' | 'apolloUrl' | 'outputPath' | 'outputStdout'
> & {
  service: string;
  payload?: string;
};

const options = [
  o.apolloUrl,
  o.stateStdin,
  o.log,
  o.logJson,
  o.outputPath,
  override(o.outputStdout, {
    default: true,
  }),
];

const desc = `Call services on the openfn apollo server. Set the local server location with OPENFN_APOLLO_SERVER. The staging server is set to ${STAGING_URL}`;

export default {
  command: 'apollo <service> [payload]',
  desc,
  handler: ensure('apollo', options),
  builder: (yargs) =>
    build(options, yargs)
      .example(
        'apollo echo path/to/json',
        'Call the echo service, which returns json back'
      )
      .example(
        'apollo adaptor_gen cat-facts.example.json --local',
        'Generate an adaptor template against a local server'
      ),
} as yargs.CommandModule<{}>;
