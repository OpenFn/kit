import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const cmd = yargs(hideBin(process.argv))
  .command('[path]', 'Run the job at the path')
  .command('--test', 'Run a trivial test job with no disk I/O')
  .example('openfn path/to/dir', 'Looks for job.js, state.json in path/to/dir')
  .example(
    'openfn foo/job.js',
    'Reads foo/job.js, looks for state and output in foo'
  )
  .example(
    'openfn job.js -adaptor @openfn/language-common',
    'Run job.js with automatic imports from the commmon language adaptor'
  )
  .example(
    'openfn job.js -adaptor @openfn/language-common=repo/openfn/language-common',
    'Run job.js with a local implementation of the common language adaptor'
  )
  .example('openfn foo/job.js -c', 'Compile a job to foo/output/js')
  .example('openfn foo/job.js -cO', 'Compile a job to stdout')
  .example(
    'openfn foo/job.js --log debug',
    'Run a job with debug-level logging'
  )
  .example(
    'openfn foo/job.js --log compiler=debug',
    'Use debug logging in the compiler only'
  )

  .positional('path', {
    describe:
      'The path to load the job from (a .js file or a dir containing a job.js file)',
    demandOption: true,
  })

  .option('test', {
    description:
      'Run a test job to exercise the installation. Pass a number via -S to multiply by 2.',
    boolean: true,
  })
  .option('output-path', {
    alias: 'o',
    description: 'Path to the output file',
  })
  .option('output-stdout', {
    alias: 'O',
    boolean: true,
    description: 'Print output to stdout (intead of a file)',
  })
  .option('state-path', {
    alias: 's',
    description: 'Path to the state file',
  })
  .option('state-stdin', {
    alias: 'S',
    description: 'Read state from stdin (instead of a file)',
  })
  .option('no-validation', {
    boolean: true,
    description: 'Skip validation',
  })
  .option('compile-only', {
    alias: 'c',
    boolean: true,
    description:
      "Compile the job but don't execute it. State is written to output.js or returned to console if -O is set.",
  })
  .option('no-compile', {
    boolean: true,
    description: 'Skip compilation',
  })
  .option('adaptors', {
    alias: ['a', 'adaptor'],
    description: 'Pass one or more adaptors in the form name=path/to/adaptor',
    array: true,
  })
  // TODO this becomes log compiler=debug
  .option('trace-linker', {
    alias: ['t', 'trace'],
    description: 'Trace module resolution output in the linker',
    boolean: true,
  })
  .option('log', {
    alias: ['l'],
    description: 'Set the default log level to none, trace, info or default',
    array: true,
  })
  .alias('v', 'version');
