import yargs from 'yargs';
import { Opts } from '../options';
import * as o from '../options';
import { build, ensure } from '../util/command-builders';

export type CompileOptions = Pick<
  Opts,
  | 'adaptors'
  | 'command'
  | 'expandAdaptors'
  | 'exportsOnly'
  | 'ignoreImports'
  | 'expressionPath'
  | 'logJson'
  | 'log'
  | 'outputPath'
  | 'outputStdout'
  | 'repoDir'
  | 'path'
  | 'useAdaptorsMonorepo'
  | 'globals'
  | 'trace'
  | 'watch'
  | 'workflowName'
> & {
  workflow?: Opts['workflow'];
  repoDir?: string;
};

const options = [
  o.expandAdaptors, // order important
  o.adaptors,
  o.exportsOnly,
  o.ignoreImports,
  o.inputPath,
  o.log,
  o.logJson,
  o.outputStdout,
  o.outputPath,
  o.repoDir,
  o.trace,
  o.useAdaptorsMonorepo,
  o.watchFlag,
  o.workflow,
];

const compileCommand: yargs.CommandModule<CompileOptions> = {
  command: 'compile [path]',
  describe:
    'Compile an openfn job, workflow, or whole project and print or save the resulting JavaScript.',
  handler: ensure('compile', options),
  builder: (yargs) =>
    build(options, yargs)
      .positional('path', {
        describe:
          'Path to a .js expression, .json/.yaml workflow, or a project directory. Omit to compile all workflows in the current project.',
      })
      .example(
        'compile foo/job.js',
        'Compiles the job at foo/job.js and prints the result to stdout'
      )
      .example(
        'compile foo/workflow.json -o foo/workflow-compiled.json',
        'Compiles the workflow and writes to the given path'
      )
      .example(
        'compile',
        'Compiles all workflows in the current project and writes JS files to compiled/'
      )
      .example(
        'compile my-workflow',
        'Compiles a single workflow by name and writes JS files to compiled/'
      )
      .example(
        'compile my-workflow -O',
        'Compiles a workflow and prints to stdout'
      )
      .example(
        'compile foo/job.js --exports-only',
        'Strips adaptor operation calls, keeping only exported declarations'
      )
      .example(
        'compile --exports-only',
        'Compiles entire project to compiled/ stripping operation calls'
      )
      .example(
        'compile foo/job.js --watch',
        'Watches the file and recompiles on every change'
      )
      .example('compile --watch', 'Compiles all workflows on change'),
};

export default compileCommand;
