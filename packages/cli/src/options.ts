import yargs, { Arguments } from 'yargs';

// big list of options which can easily be re-used
// should I have ensure helpers to?

// So this lets us centralise the logic, but how is it reused?
// how do we connect the yargs argument?
// Bit of a difficulty with multiple or single adaptors
// Really we only need a single adaptor and will for a long time
// (forever?)
// Is that true of install? openfn repo install -a http dhis2 

const def = (opts, key, value) => {
    const v = opts[key];
    if (!isNaN(v) || !v) {
        opts[key] = value;
    }
}

export const adaptors = ({ required } = {}) => ({
    ensure: (opts) => {
        // TODO ensure array
        // TODO can we handle expansion here? yes...
        def(opts, 'adaptors', [])
    },
    // TODO is there any way I can override or extend this? ie to make mandatory?
    build: (yargs) => yargs.option('adaptors', {
        alias: ['a', 'adaptor'],
        description:
        'A language adaptor to use for the job. Short-form names are allowed. Can include an explicit path to a local adaptor build',
        array: true,
        demandOption: required
    })
});

export const immutable = () => ({
    ensure: (opts) => {
        def(opts, 'immutable', false)
    },
    build: (yargs) => yargs.option('immutable', {
        description: 'Treat state as immutable',
        boolean: true,
    })
});