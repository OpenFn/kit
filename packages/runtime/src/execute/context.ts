import vm from 'node:vm';
import type { Options, State } from '../types';

const freezeAll = (obj: object, exclude: Record<string, true> = {}) => {
  const copy = {};
  for (const key in obj) {
    copy[key] = exclude[key] ? obj[key] : Object.freeze(obj[key]);
  }
  return copy;
};

// Build a safe and helpful execution context
// This will be shared by all jobs
export default (state: State, options: Pick<Options, 'jobLogger'>) => {
  const logger = options.jobLogger ?? console;
  const context = vm.createContext(
    freezeAll(
      {
        console: logger,
        clearInterval,
        clearTimeout,
        parseFloat,
        parseInt,
        setInterval,
        setTimeout,
        state, // TODO I don't really want to pass global state through
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
