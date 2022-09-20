import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'

export const cmd = yargs(hideBin(process.argv)).command('openfn [path]' , "Run the job at the provided path")
  .example('openfn path/to/dir', 'Looks for job.js, state.json in path/to/dir')
  .example('openfn path/to/job.js', 'Reads job.js, looks for state next to it, and outputs next to it')
  .example('openfn path/to/job.js --adaptor language-common=repo/openfn/language-common language-http=repo/openfn/language-http', 'Pass several local adaptor modules into the job')
  .positional('path', {
    describe: 'The path to load the job from'
  })
  .option('output-path', {
    alias: 'o',
    description: 'Path to the output file',
  })
  .option('output-stdout', {
    alias: 'O',
    boolean: true,
    description: 'Output to stdout',
  })
  .option('state-path', {
    alias: 's',
    description: 'Path to the state file'
  })
  .option('state-stdin', {
    alias: 'S',
    description: 'Read state from stdin'
  })
  .option('no-validation', {
    boolean: true,
    description: 'Skip validation'
  })
  .option('no-compile', {
    boolean: true,
    description: 'Skip compilation'
  })
  .option('adaptors', {
    alias: ['a', 'adaptor'],
    description: 'Pass one or more adaptors in the form name=path/to/adaptor',
    array: true
  })
  .option('trace-linker', {
    alias: ['t', 'trace'],
    description: 'Trace module resolution output in the linker',
    boolean: true,
  });