import yargs from 'yargs';
import { build, ensure, override } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type FetchOptions = Required<
  Pick<
    Opts,
    | 'beta'
    | 'command'
    | 'log'
    | 'logJson'
    | 'statePath'
    | 'projectPath'
    | 'configPath'
    | 'projectId'
    | 'confirm'
    | 'snapshots'
  >
>;

const options = [
  o.apikey,
  o.beta,
  o.beta,
  o.configPath,
  o.endpoint,
  o.env,
  o.log,
  override(o.path, {
    description: 'path to output the project to',
  }),
  o.logJson,
  o.projectPath,
  o.snapshots,
  o.statePath,
  o.path,
];

const fetchCommand: yargs.CommandModule<FetchOptions> = {
  command: 'fetch [projectId]',
  describe: `Fetch a project's state and spec from a Lightning Instance to the local state file without expanding to the filesystem.`,
  builder: (yargs: yargs.Argv<FetchOptions>) =>
    build(options, yargs)
      .positional('projectId', {
        describe:
          'The id of the project that should be fetched, should be a UUID',
        demandOption: true,
      })
      .example(
        'fetch 57862287-23e6-4650-8d79-e1dd88b24b1c',
        'Fetch an updated copy of a the above spec and state from a Lightning Instance'
      ),
  handler: ensure('fetch', options),
};

export default fetchCommand;
