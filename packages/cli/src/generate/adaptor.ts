/**
 * Handler to generate adaptor code
 */
import path from 'node:path';
import fs from 'node:fs/promises';

import { Opts } from '../options';
import { Logger } from '../util';
import loadGenSpec from './adaptor/load-gen-spec';

// TODO: really I just want one domain here
const endpoints = {
  signature: 'http://localhost:8001/generate_signature',
  code: 'http://localhost:8002/generate_code/',
};

export type AdaptorGenOptions = Pick<
  Opts,
  | 'command'
  | 'path' // path to spec - we proably want to override the description
  | 'log' // same log rules
  | 'logJson'
  | 'monorepoPath' // maybe use the monorepo (or use env var)
  | 'outputPath' // where to output to. Defaults to monorepo or as sibling of the spec
> & {
  adaptor?: string;
  spec?: string;

  // TODO spec overrides
};

// spec.spec is silly, so what is this object?
export type Spec = {
  adaptor?: string; // adaptor name. TOOD rename to name?

  spec: any; // OpenAPI spec. TODO rename to api?

  instruction: string; // for now... but we'll use endpoints later

  endpoints?: string[]; // TODO not supported yet

  model?: string; // TODO not supported yet
};

const generateAdaptor = async (opts: AdaptorGenOptions, logger: Logger) => {
  // Load the input spec from the cli options
  const spec = await loadGenSpec(opts, logger);

  // TODO Validate that the spec looks correct

  // if we're using the monorepo, and no adaptor with this name exists
  // prompt to generate it
  // humm is that worth it? it'll create a git diff anyway

  const sig = await generateSignature(spec, logger);
  const code = await generateCode(spec, sig, logger);

  await simpleOutput(opts, logger, sig, code);

  return { sig, code };
};

export default generateAdaptor;

// throw if the spec is missing anything
const validateSpec = () => {};

// simple output means we write adaptor.js and adaptor.d.ts to disk
// next to the input path
// This is what we run in non-monorepo mode
const simpleOutput = async (
  opts: AdaptorGenOptions,
  logger: Logger,
  sig: string,
  code: string
) => {
  const outputPath = path.resolve(path.dirname(opts.path ?? '.'));

  const sigPath = `${outputPath}/adaptor.d.ts`;
  logger.debug(`Writing sig to ${sigPath}`);
  await fs.writeFile(sigPath, sig);

  const codePath = `${outputPath}/adaptor.js`;
  logger.debug(`Writing code to ${sigPath}`);
  await fs.writeFile(codePath, code);

  logger.success(`Output adaptor.js and adaptor.d.ts to ${outputPath}`);
};

const monorepoOutput = async (
  opts: AdaptorGenOptions,
  logger: Logger,
  sig: string,
  code: string
) => {
  // Check if this adaptor exists in the monorepo
  // If not, call a monorepo helper to generate a stub
  // Now write adaptor.d.ts and adaptor.js into the monorepo structure
  // (Right now, we don't care if this overwrites existing code)
};

const convertSpec = (spec: Spec) =>
  JSON.stringify({
    open_api_spec: spec.spec,
    instruction: spec.instruction,

    // For now we force this model
    model: 'gpt3_turbo',
  });

const generateSignature = async (spec: Spec, logger: Logger) => {
  // generate signature
  const result = await fetch(endpoints.signature, {
    method: 'POST',
    body: convertSpec(spec),
    headers: {
      ['Content-Type']: 'application/json',
    },
  });
  const json = await result.json();
  logger.success('Generated signature:\n', json.signature);

  return json.signature;
};

const generateCode = async (spec: Spec, signature: string, logger: Logger) => {
  const result = await fetch(endpoints.code, {
    method: 'POST',
    body: JSON.stringify({
      // TODO why doesn't code gen use the spec??
      signature,
      model: 'gpt3_turbo',
    }),
    headers: {
      ['Content-Type']: 'application/json',
    },
  });
  const json = await result.json();
  logger.success('Generated code:\n', json.implementation);
  return json.implementation;
};
