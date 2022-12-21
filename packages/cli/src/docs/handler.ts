import { readFile } from 'node:fs/promises';

import docgen from '../docgen/handler';
import { Opts } from '../commands';
import { createNullLogger } from '../util/logger';
import type { Logger } from '../util/logger';
import type {
  FunctionDescription,
  PackageDescription,
} from '@openfn/describe-package';

import { getNameAndVersion, getLatestVersion } from '@openfn/runtime';
import expandAdaptors from '../util/expand-adaptors';

const describeFn = (adaptorName: string, fn: FunctionDescription) => `## ${
  fn.name
}(${fn.parameters.map(({ name }) => name).join(',')})

${fn.description}

### Usage Examples

${
  fn.examples.length
    ? fn.examples
        .map(({ code, caption }) => {
          if (caption) {
            return `${caption}:\n${code}`;
          }
          return code;
        })
        .join('\n\n')
    : 'None'
}

### API Reference

https://docs.openfn.org/adaptors/packages/${adaptorName.replace(
  '@openfn/language-',
  ''
)}-docs#${fn.name}
`;

const describeLib = (
  adaptorName: string,
  data: PackageDescription
) => `## ${adaptorName} ${data.version}

${data.functions
  .map((fn) => `  ${fn.name}(${fn.parameters.map((p) => p.name).join(', ')})`)
  .sort()
  .join('\n')}
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
    version = await getLatestVersion(name);
    logger.info('Found ', version);
    logger.success(`Showing docs for ${adaptorName} v${version}`);
  }

  // First we need to generate docs metadata (this is a no-op if they exist already)
  logger.info('Generating/loading documentation...');
  const path = await docgen(
    {
      specifier: `${name}@${version}`,
      repoDir,
    },
    // TODO I'm not sure how to handle logging here - we ought to feedback SOMETHING though
    createNullLogger()
  );

  // If docgen succeeded, we should have a path to the metadata
  if (path) {
    const source = await readFile(path, 'utf8');
    const data = JSON.parse(source);

    let desc;
    if (operation) {
      const fn = data.functions.find(({ name }) => name === operation);
      logger.debug('Operation schema:', fn);
      logger.success(`Documentation for ${name}.${operation} v${version}:\n`);

      // Generate a documentation string
      desc = describeFn(name, fn);
    } else {
      logger.debug('No operation provided, listing available operations');
      desc = describeLib(name, data);
    }
    // Log the description without any ceremony/meta stuff from the logger
    logger.print(desc);

    logger.success('Done!');
  } else {
    logger.error('Not found');
  }
};

export default docsHandler;
