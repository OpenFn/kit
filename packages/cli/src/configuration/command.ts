import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure, override } from '../util/command-builders';

export type ConfigOptions = Pick<
  Opts,
  'log' | 'logJson' | 'outputPath' | 'outputStdout' | 'configType'
> & {
  adaptor: string;
};

const options = [
  o.log,
  o.logJson,
  o.outputPath,
  o.configType,
  override(o.outputStdout, {
    default: true,
  }),
];

export default {
  command: 'configuration <adaptor>',
  handler: ensure('configuration', options),
  describe: 'Returns the sample and full configuration of the adaptor. You can use flags (schema, sample or both(default)) to return only the sample or full configuration.',
  builder: (yargs) =>
    build(options, yargs)
      .example(
        'configuration adaptor_name@version',
        'Returns the sample and full configuration of the adaptor for a given version.'
      )
      .example(
        'configuration adaptor_name --sample',
        'Returns only the sample configuration of the adaptor for the latest version.'
      ),
} as yargs.CommandModule<{}>;
