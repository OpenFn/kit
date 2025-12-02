import yargs from 'yargs';
import { build, ensure, override } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type PullOptions = Required<
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

  // These are hidden commands used only by beta
  // The need to be declared here to be initialised and defaulted properly
  override(o.force, { hidden: true }),
  override(o.workspace, { hidden: true }),
];

const pullCommand: yargs.CommandModule<PullOptions> = {
  command: 'pull [projectId]',
  describe: `Pull a project's state and spec from a Lightning Instance to the local directory. Pass --beta to use the experimental new pull command. See https://github.com/OpenFn/kit/wiki/Pull-Deploy-Beta for docs`,
  builder: (yargs: yargs.Argv<PullOptions>) =>
    build(options, yargs)
      .positional('projectId', {
        describe:
          'The id of the project that should be pulled shouled be a UUID',
        demandOption: true,
      })
      .example(
        'pull 57862287-23e6-4650-8d79-e1dd88b24b1c',
        'Pull an updated copy of a the above spec and state from a Lightning Instance'
      ),
  handler: ensure('pull', options),
};

export default pullCommand;
