import { writeFile } from 'node:fs/promises';
import type { CompileOptions } from './command';
import type { Logger } from '../util/logger';

import compile from './compile';
import loadInput from '../util/load-input';
import expandAdaptors from '../util/expand-adaptors';
import assertPath from '../util/assert-path';
import mapAdaptorsToMonorepo, {
  MapAdaptorsToMonorepoOptions,
} from '../util/map-adaptors-to-monorepo';

const compileHandler = async (options: CompileOptions, logger: Logger) => {
  assertPath(options.path);
  // TODO use loadPlan
  await loadInput(options, logger);

  // if (options.workflow) {
  //   // expand shorthand adaptors in the workflow jobs
  //   expandAdaptors(options);
  //   await mapAdaptorsToMonorepo(
  //     options as MapAdaptorsToMonorepoOptions,
  //     logger
  //   );
  // }

  let result = await compile(options, logger);
  if (options.workflow) {
    result = JSON.stringify(result);
  }
  if (options.outputStdout) {
    logger.success('Compiled code:');
    logger.success('\n' + result);
  } else {
    await writeFile(options.outputPath!, result as string);
    logger.success(`Compiled to ${options.outputPath}`);
  }
};

export default compileHandler;
