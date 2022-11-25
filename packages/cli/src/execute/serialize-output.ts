import { writeFile } from 'node:fs/promises';
import stringify from 'fast-safe-stringify';
import { Logger } from '../util/logger';
import { Opts } from '../commands';
const serializeOutput = async (
  options: Pick<Opts, 'strictOutput' | 'outputStdout' | 'outputPath'>,
  result: any,
  logger: Logger
) => {
  let output = result;
  if (output && (output.configuration || output.data)) {
    // handle an object. Probably need a better test.
    const { data, configuration, ...rest } = result;
    if (options.strictOutput !== false) {
      output = { data };
    } else {
      output = {
        data,
        ...rest,
      };
    }
  }

  if (output === undefined) {
    output = '';
  } else {
    output = stringify(output, null, 2);
  }

  if (options.outputStdout) {
    logger.success(`Result: `);
    logger.success(output);
  } else if (options.outputPath) {
    logger.success(`Writing output to ${options.outputPath}`);
    await writeFile(options.outputPath, output);
  }

  return output;
};

export default serializeOutput;
