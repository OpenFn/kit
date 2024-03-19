import { readFile } from 'node:fs/promises';
import c from 'chalk';

import docgen from '../docgen/handler';
import { Opts } from '../options';
import { createNullLogger } from '../util/logger';
import type { Logger } from '../util/logger';
import type {
  FunctionDescription,
  PackageDescription,
} from '@openfn/describe-package';

import { getNameAndVersion, getLatestVersion } from '@openfn/runtime';
import expandAdaptors from '../util/expand-adaptors';

const describeFn = (adaptorName: string, fn: FunctionDescription) => [
  c.green(`## ${
  fn.name
}(${fn.parameters.map(({ name }) => name).join(',')})`),
`${fn.description}`,
c.green('### Usage Examples'),
fn.examples.length
    ? fn.examples
        .map(({ code, caption }) => {
          if (caption) {
            return `${caption}:\n${code}`;
          }
          return code;
        })
        .join('\n\n')
    : 'None',
c.green('### API Reference'),
`https://docs.openfn.org/adaptors/packages/${adaptorName.replace(
  '@openfn/language-',
  ''
)}-docs#${fn.name}
`].join('\n\n');

const describeLib = (
  adaptorName: string,
  data: PackageDescription
) => c.green(`## ${adaptorName} ${data.version}`)  + `

${data.functions
  .map((fn) => `  ${c.yellow(fn.name)} (${fn.parameters.map((p) => p.name).join(', ')})`)
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
  const adaptors = expandAdaptors([adaptor]) as string[];
  const [adaptorName] = adaptors!;
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
  let didError = false;
  if (path) {
    const source = await readFile(path, 'utf8');
    const data = JSON.parse(source) as PackageDescription;

    let desc;
    if (operation) {
      const fn = data.functions.find(({ name }) => name === operation);
      if (fn) {
        logger.debug('Operation schema:', fn);
        logger.break()

        // Generate a documentation string
        desc = describeFn(name, fn);
      } else {
        logger.error(`Failed to find ${operation} in ${name}`);
      }
    } else {
      logger.debug('No operation name provided');
      logger.always('Available functions:\n');
      desc = describeLib(name, data);

    }
    // Log the description without any ceremony/meta stuff from the logger
    logger.print(desc);

    if (!operation) {
      logger.always(`For more details on a specfic functions, use:
    
    openfn docs ${name} <fn>
`)
    }

    if (didError) {
      logger.error('Error');
    } else {
      logger.info('Done!');
    }
  } else {
    logger.error('Not found');
  }
};

export default docsHandler;
