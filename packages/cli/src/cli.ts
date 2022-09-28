import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'

export const cmd = yargs(hideBin(process.argv))
  .command('openfn [path]' , "Run the job at the path")
  .example('openfn path/to/dir', 'Looks for job.js, state.json in path/to/dir')
  .example('openfn foo/job.js', 'Reads foo/job.js, looks for state and output in foo')
  .example('openfn job.js -adaptor @openfn/language-common', 'Run job.js with automatic imports from the commmon language adaptor')
  .example('openfn job.js -adaptor @openfn/language-common=repo/openfn/language-common', 'Run job.js with a local implementation of the common language adaptor')
  .example('openfn foo/job.js -c', 'Compile a job to foo/output/js')
  .example('openfn foo/job.js -cO', 'Compile a job to stdout')
  .positional('path', {
    describe: 'The path to load the job from (a .js file or a dir containing a job.js file)',
    demandOption: true
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
    description: 'Path to the state file'
  })
  .option('state-stdin', {
    alias: 'S',
    description: 'Read state from stdin (instead of a file)'
  })
  .option('no-validation', {
    boolean: true,
    description: 'Skip validation'
  })
  .option('compile-only', {
    alias: 'c',
    boolean: true,
    description: 'Skip compilation'
  })
  .option('no-compile', {
    boolean: true,
    description: 'Skip compilation'
  })
  .option('adaptors', {
    alias: ['a', 'adaptor'],
    description: 'Pass one or more adaptors in the form name[]=path/to/adaptor]',
    array: true
  })
  .option('trace-linker', {
    alias: ['t', 'trace'],
    description: 'Trace module resolution output in the linker',
    boolean: true,
  })
  // .version(false)
  .option('version', {
    alias: ['v'],
    description: 'Print the version of the CLI',
    boolean: true,
  });