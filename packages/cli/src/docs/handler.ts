import { readFile, writeFile } from 'node:fs/promises';
import path, { join } from 'node:path';

import docgen from '../docgen/handler';
import { Opts } from '../commands';
import { createNullLogger } from '../util/logger';
import type { Logger } from '../util/logger';
import type { FunctionDescription } from '@openfn/describe-package';

import { getNameAndVersion, getLatestVersion } from '@openfn/runtime';

// TODO this is kinda hard to unit test...
const describe = (fn: FunctionDescription) => `## ${fn.name}(${fn.parameters
  .map(({ name }) => name)
  .join(',')})

${fn.description}

### Usage Examples

${fn.examples.length ? fn.examples.map((eg) => eg).join('\n\n') : 'None'}
`;

const docsHandler = async (
  options: Required<Pick<Opts, 'adaptor' | 'operation' | 'repoDir'>>,
  logger: Logger
): Promise<void> => {
  const { adaptor, operation, repoDir } = options;

  // does the adaptor have a version? If not, fetch the latest
  // (docgen won't do this for us)
  let { name, version } = getNameAndVersion(adaptor as unknown as string); // TODO garbage typings
  if (!version) {
    logger.info('No version number provided, looking for latest');
    version = await getLatestVersion(version);
    logger.success(`Showing docs for ${name} v${version}`);
  }

  // so first we need to generate docs (a noop if they exist)
  logger.info('Generating/loading documetation...');
  const path = await docgen(
    {
      specifier: `${name}@${version}`,
      repoDir,
    },
    // TODO maybe create a new logger here?
    // Interestingly we don't want to log the path to docs
    // We really only want to report if it goes into heavy docgen
    createNullLogger()
  );

  // Then we get the json
  const source = await readFile(path, 'utf8');
  const data = JSON.parse(source);

  const fn = data.functions.find(({ name }) => name === operation);
  logger.debug('Operation schema:', fn);
  logger.success(`Documentation for ${name}.${operation} v${version}:\n`);
  const desc = describe(fn);
  logger.print(desc);

  logger.success('Done!');

  // find out function (or error)

  // then print the info
};

export default docsHandler;
