import { readFile, writeFile } from 'node:fs/promises';
import { Opts } from '../commands';
import type { Logger } from '../util/logger';

// import { describePackage, PackageDescription } from '@openfn/describe-package';
// openfn docgen commmon
// openfn help common fn

type DocGenFn = (specifier: string) => PackageDescription;

// const actualDocGen: DocGenFn = (specifier: string) =>
//   describePackage(specifier);

const ensureRepo = () => {};

export const generatePlaceholder = async (path: string) => {
  await writeFile(path, `{ "loading": true, "timestamp": ${Date.now()}}`);
};

const docsHandler = async (
  options: Required<Pick<Opts, 'specifier' | 'repoDir'>>,
  logger: Logger,
  docgen: DocGenFn /*= actualDocGen*/
) => {
  const { specifier, repoDir } = options;

  // TODO ensure the specifier is correct
  // If there's no version, we nede to add one
  // TODO check the repo exists and is intialised?

  const path = `${repoDir}/docs/${specifier}.json`;

  try {
    // TODO probably also needs to be sync?
    const existing = await readFile(path, 'utf8');
    if (existing) {
      try {
        const existingJSON = JSON.parse(existing);
        if (existingJSON.loading) {
          // if this is a placeholder... set an interval and wait for JSON to be written
          // then return the value
          // An even smarter approach would be to watch with chokidar
        } else {
          // If we get here the docs have been written, everything is fine
          // TODO should we sanity check the name and version? Would make sense
        }
      } catch (e) {
        // If something is wrong with the current JSON, abort for now
        // To be fair it may not matter as we'll write over it anyway
        // Maybe we should encourge a openfn docs purge <specifier> or something
        logger.error('Existing doc JSON corrupt. Aborting.');
      }
    }
  } catch (e) {
    // If the file does not exist and is not loading, generate the docs and write
    // TODO actually should be sync because this is high priority
    await generatePlaceholder(path);

    // generate docs if needed
    const result = await docgen(specifier);

    await writeFile(path, JSON.stringify(result, null, 2));
  }

  return path;
};

export default () => {
  console.log('hello world');
};
// export default docsHandler;
