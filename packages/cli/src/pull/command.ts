import yargs from 'yargs';
import { build, ensure } from '../util/command-builders';
import { Opts } from '../options';
import * as o from '../options';

export type DeployOptions = Required<
  Pick<
    Opts,
    'command' | 'log' | 'logJson' | 'statePath' | 'projectPath' | 'configPath'
  >
>;

const options = [o.statePath, o.projectPath, o.configPath, o.log, o.logJson];

const pullCommand: yargs.CommandModule<DeployOptions> = {
  command: 'pull',
  describe:
    "Pull a project's state and spec from a Lightning Instance to the local directory",
  builder: (yargs: yargs.Argv<DeployOptions>) => {
    return build(options, yargs).example(
      'pull',
      'Pull an updated copy of a project spec and state from a Lightning Instance'
    );
  },
  handler: ensure('pull', options),
};

export default pullCommand;
