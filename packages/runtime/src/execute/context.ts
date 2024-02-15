import vm from 'node:vm';
import type { State } from '@openfn/lexicon';
import type { Options } from '../runtime';

const freezeAll = (
  obj: Record<string, any>,
  exclude: Record<string, true> = {}
) => {
  const copy: typeof obj = {};
  for (const key in obj) {
    copy[key] = exclude[key] ? obj[key] : Object.freeze(obj[key]);
  }
  return copy;
};

// Build a safe and helpful execution context
// This will be shared by all jobs
export default (
  state: State,
  options: Pick<Options, 'jobLogger' | 'globals'>
) => {
  const logger = options.jobLogger ?? console;
  const globals = options.globals || {};
  const context = vm.createContext(
    freezeAll(
      {
        ...globals,
        // Note that these globals will be overridden
        console: logger,
        clearInterval,
        clearTimeout,
        parseFloat,
        parseInt,
        setInterval,
        setTimeout,
        state, // TODO will be dropped as a global one day, see https://github.com/OpenFn/kit/issues/17
      },
      { state: true }
    ),
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    }
  );

  return context;
};

// Special, highly restricted cotext for a plan condition
// Ie, a javascript expression
export const conditionContext = () => {
  const context = vm.createContext(
    {
      console,
    },
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    }
  );

  return context;
};

export type Context = vm.Context;
