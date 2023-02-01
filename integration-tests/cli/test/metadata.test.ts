import test from 'ava';
import path from 'node:path';

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
  }
);

// TODO second load should come from cache
