import test from 'ava';
import path from 'node:path';
import { differenceInMinutes } from 'date-fns';
import run from '../src/run';
import { getJSON } from './util';

const state = '{ \\"configuration\\": { \\"url\\": \\"x\\" } }';
const modulePath = path.resolve('modules/test/index.js'); // TODO need to build more leniency into this path
test.serial(
  `openfn metadata -S "${state}" -a test=${modulePath}`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);

    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Read state from stdin/);

    const output = stdout.split('\n');
    output.pop();
    const lastLine = output.pop();
    t.regex(lastLine, /(repo\/meta\/)*(\.json)/);

    const metadata = getJSON(lastLine);
    t.is(metadata.name, 'test');
    t.is(metadata.type, 'model');

    // Check the created timestamp
    // As this is added at the very end, the created timestamp should be
    // within seconds of the current date.
    // We'll use a minute to give us plenty of leeway
    t.assert(differenceInMinutes(new Date(metadata.created), new Date()) < 1);
  }
);

// TODO second load should come from cache
