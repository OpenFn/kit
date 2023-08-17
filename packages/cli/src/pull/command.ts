import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type PullOptions = Required<
  Pick<
    Opts,
    'command' | 'log' | 'logJson' | 'statePath' | 'projectPath' | 'configPath' | 'projectId'
  >
>;

const options = [o.statePath, o.projectPath, o.configPath, o.log, o.logJson];

const pullCommand: yargs.CommandModule<PullOptions> = {
  command: 'pull [projectId]',
  describe:
    "Pull a project's state and spec from a Lightning Instance to the local directory",
  builder: (yargs: yargs.Argv<PullOptions>) => 
     build(options, yargs)
    .positional('projectId', {
                describe: 
                    'The id of the project that should be pulled shouled be a UUID',
                demandOption: true,
    }).example(
      'pull 57862287-23e6-4650-8d79-e1dd88b24b1c',
      'Pull an updated copy of a the above spec and state from a Lightning Instance'
    ),
  handler: ensure('pull', options),
};

export default pullCommand;
