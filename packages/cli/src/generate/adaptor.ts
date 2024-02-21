/**
 * Handler to generate adaptor code
 */

import { Opts } from '../options';
import { Logger } from '../util';
import mailchimp from './mailchimp-spec.json' assert { type: 'json' };

// TODO: really I just want one domain here
const endpoints = {
  signature: 'http://localhost:8001/generate_signature',
  code: 'http://localhost:8002/generate_code/',
};

type AdaptorGenOptions = Pick<
  Opts,
  | 'command'
  | 'path' // path to spec - we proably want to override the description
  | 'log' // same log rules
  | 'logJson'
  | 'monorepoPath' // maybe use the monorepo (or use env var)
  | 'outputPath' // where to output to. Defaults to monorepo or as sibling of the spec
> & {
  adaptor: string;

  // TODO spec overrides
};

// spec.spec is silly, so what is this object?
type Spec = {
  spec: any; // OpenAPI spec

  instruction: string; // for now... but we'll use endpoints later

  endpoints?: string[]; // TODO not supported yet

  model?: string; // TODO not supported yet
};

const generateAdaptor = async (opts: any, logger: Logger) => {
  logger.success('** GENERATE ADAPTOR**');
  // if we're using the monorepo, and no adaptor with this name exists
  // prompt to generate it
  // humm is that worth it? it'll create a git diff anyway

  // TODO load spec from path
  // gonna hard code it right now
  const spec = {
    spec: mailchimp, // post as open_api_spec
    instruction: 'Create an OpenFn function that accesses the /goals endpoint',
  };

  const sig = await generateSignature(spec, logger);
  const code = await generateCode(spec, sig, logger);

  // Now we need to output to disk

  return { sig, code };
};

export default generateAdaptor;

// throw if the spec is missing anything
const validateSpec = () => {};

// this will generate a basic package for the adaptor
// what is a good way to do this?
const generatePackageTemplate = () => {
  // package json
  // src
  // Adaptor.js
  // index.js
  // readme.md
};

const convertSpec = (spec: Spec) =>
  JSON.stringify({
    open_api_spec: spec.spec,
    instruction: spec.instruction,
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

  // TODO write output

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
