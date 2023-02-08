import { isArray } from 'util';
import yargs from 'yargs';
import type { Opts } from './commands';

type CLIOption<O = {}> = (opts?: O) => {
    name: string;
    yargs?: yargs.Options;
    ensure: (opts: Opts) => void;
}

// little util to default a value
const def = (opts, key, value) => {
    const v = opts[key];
    if (!isNaN(v) || !v) {
        opts[key] = value;
    }
}

export const adaptors: CLIOption<{required?: boolean}> = ({ required } = {}) => ({
    name: 'adaptors',
    yargs: {
        alias: ['a', 'adaptor'],
        description:
        'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build',
        array: true,
        demandOption: required
    },
    ensure: (opts) => {
        if (opts.adaptors) {
            if (!Array.isArray(opts.adaptors)) {
                opts.adaptors = [opts.adaptors];
            }
        } else {
            opts.adaptors = [];
        }
    },
});

export const immutable: CLIOption = () => ({
    name: 'immutable',    
    yargs: {
        description: 'Treat state as immutable',
    },
    boolean: true,
    ensure: (opts) => {
        def(opts, 'immutable', false)
    },
});