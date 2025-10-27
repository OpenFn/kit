import yargs from 'yargs';
import { Opts } from '../options';
import { ensure, build, override } from '../util/command-builders';
import * as o from '../options';

export type MergeOptions = Required<
  Pick<
    Opts,
    | 'command'
    | 'projectName'
    | 'projectPath'
    | 'removeUnmapped'
    | 'workflowMappings'
    | 'log'
    | 'force'
  >
>;

const options = [
  o.projectName,
  o.projectPath,
  o.removeUnmapped,
  o.workflowMappings,
  o.log,
  override(o.force, {
    description: 'Force a merge even when workflows are incompatible',
  }),
];

const mergeCommand: yargs.CommandModule = {
  command: 'merge [project-name]',
  describe: 'Merges the specified project into the checked out project',
  handler: ensure('merge', options),
  builder: (yargs) => build(options, yargs),
};

export default mergeCommand;
