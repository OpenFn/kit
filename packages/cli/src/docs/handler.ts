import { readFile } from 'node:fs/promises';

import docgen from '../docgen/handler';
import { Opts } from '../commands';
import { createNullLogger } from '../util/logger';
import type { Logger } from '../util/logger';
import type { FunctionDescription } from '@openfn/describe-package';

import { getNameAndVersion, getLatestVersion } from '@openfn/runtime';
import expandAdaptors from '../util/expand-adaptors';

// TODO this is kinda hard to unit test...
const describe = (adaptorName: string, fn: FunctionDescription) => `## ${
  fn.name
}(${fn.parameters.map(({ name }) => name).join(',')})

${fn.description}

### Usage Examples

${fn.examples.length ? fn.examples.map((eg) => eg).join('\n\n') : 'None'}

### API Reference

https://docs.openfn.org/adaptors/packages/${adaptorName.replace(
  '@openfn/language-',
  ''
)}-docs#${fn.name}
`;

const docsHandler = async (
  options: Required<Pick<Opts, 'operation' | 'repoDir'>> & { adaptor: string },
  logger: Logger
): Promise<void> => {
  const { adaptor, operation, repoDir } = options;

  // does the adaptor have a version? If not, fetch the latest
  // (docgen won't do this for us)
  const [adaptorName] = expandAdaptors([adaptor], logger);
  let { name, version } = getNameAndVersion(adaptorName);
  if (!version) {
    logger.info('No version number provided, looking for latest...');
    version = await getLatestVersion(version);
    logger.info('Found ', version);
    logger.success(`Showing docs for ${adaptorName} v${version}`);
  }

  // so first we need to generate docs (a noop if they exist)
  logger.info('Generating/loading documentation...');
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
  if (path) {
    const source = await readFile(path, 'utf8');
    const data = JSON.parse(source);

    const fn = data.functions.find(({ name }) => name === operation);
    logger.debug('Operation schema:', fn);
    logger.success(`Documentation for ${name}.${operation} v${version}:\n`);
    const desc = describe(name, fn);
    logger.print(desc);

    logger.success('Done!');
  } else {
    logger.error('Not found');
  }
};

export default docsHandler;
