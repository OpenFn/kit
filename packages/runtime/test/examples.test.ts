import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from "ava";
import run from '../src/index';

test('simple state transformation', async (t) => {
  const p = path.resolve('test/examples/simple-state-transformation.js');
  const source = await readFile(p, 'utf8');
  const result  = await run(source);
  // @ts-ignore
  t.assert(result.data.count === 10);
})