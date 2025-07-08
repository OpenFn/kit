import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import type { Opts } from '../options';
import * as o from '../options';

export type MetadataOpts = Required<Pick<Opts, 'adaptors' | 'repoDir'>> &
  Pick<
    Opts,
    | 'expandAdaptors'
    | 'force'
    | 'keepUnsupported'
    | 'log'
    | 'logJson'
    | 'statePath'
    | 'stateStdin'
    | 'useAdaptorsMonorepo'
  >;

const options = [
  o.expandAdaptors, // order is important

  o.adaptors,
  o.force,
  o.keepUnsupported,
  o.log,
  o.logJson,
  o.repoDir,
  o.statePath,
  o.stateStdin,
  o.useAdaptorsMonorepo,
];

export default {
  command: 'metadata',
  describe: 'Generate metadata for an adaptor config',
  handler: ensure('metadata', options),
  builder: (yargs) =>
    build(options, yargs).example(
      'metadata -a salesforce -s tmp/state.json',
      'Generate salesforce metadata from config in state.json'
    ),
} as yargs.CommandModule<MetadataOpts>;
