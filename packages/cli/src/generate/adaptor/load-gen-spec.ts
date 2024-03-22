import path from 'node:path';
import fs from 'node:fs/promises';

import type { AdaptorGenOptions, Spec } from '../adaptor';
import { Logger, abort } from '../../util';

// single standalone function to parse all the options and return a spec object
// I can unit test this comprehensively you see
const loadGenSpec = async (opts: AdaptorGenOptions, logger: Logger) => {
  let spec: Partial<Spec> = {};

  if (opts.path) {
    const inputPath = path.resolve(opts.path);
    logger.debug(`Loading input spec from ${inputPath}`);

    try {
      const text = await fs.readFile(inputPath, 'utf8');
      spec = JSON.parse(text);
    } catch (e) {
      return abort(
        logger,
        'spec load error',
        undefined,
        `Failed to load a codegen specc from ${inputPath}`
      );
    }
  }

  if (opts.spec) {
    spec.spec = opts.spec;
  }
  if (opts.adaptor) {
    spec.adaptor = opts.adaptor;
  }

  if (typeof spec.spec === 'string') {
    // TODO if opts.path isn't set I think this will blow up
    const specPath = path.resolve(path.dirname(opts.path ?? '.'), spec.spec);
    logger.debug(`Loading OpenAPI spec from ${specPath}`);
    try {
      const text = await fs.readFile(specPath, 'utf8');
      spec.spec = JSON.parse(text);
    } catch (e) {
      return abort(
        logger,
        'OpenAPI error',
        undefined,
        `Failed to load openAPI spec from ${specPath}`
      );
    }
  }

  // if no name provided, see if we can pull one from the spec
  if (!spec.adaptor) {
    // TOOD use a lib for this?
    spec.adaptor = spec.spec.info?.title?.toLowerCase().replace(/\W/g, '-');
  }

  logger.debug(`Final spec: ${JSON.stringify(spec, null, 2)}`);

  return spec as Required<Spec>;
};

export default loadGenSpec;
