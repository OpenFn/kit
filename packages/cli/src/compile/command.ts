import yargs from 'yargs';
import { Opts } from '../options';
import * as o from '../options';
import { build, ensure, override } from '../util/command-builders';

export type CompileOptions = Pick<
  Opts,
  | 'adaptors'
  | 'command'
  | 'expandAdaptors'
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
  | 'test'
  | 'strip'
  | 'trace'
  | 'watch'
> & {
  workflow?: Opts['workflow'];
  repoDir?: string;
};

const options = [
  o.expandAdaptors, // order important
  o.adaptors,
  o.ignoreImports,
  o.inputPath,
  o.log,
  o.logJson,
  override(o.outputStdout, {
    default: true,
  }),
  o.outputPath,
  o.repoDir,
  o.testFlag,
  o.stripFlag,
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
        'Compiles all workflows in the current project and writes JS files to tests/'
      )
      .example(
        'compile foo/job.js --test',
        'Strips adaptor operation calls and writes to tests/ (for unit testing)'
      )
      .example(
        'compile foo/job.js --test --no-strip',
        'Compiles for testing without stripping operation calls'
      )
      .example(
        'compile foo/job.js --watch',
        'Watches the file and recompiles on every change'
      )
      .example(
        'compile --test --watch',
        'Compiles all workflows in strip mode and recompiles on change'
      ),
};

export default compileCommand;
