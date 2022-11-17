import test from 'ava';
import { describeDts } from '../src';
import { Project } from '../src/typescript/project';
import { getDtsFixture, setupProject } from './helpers';

test('describe exported functions', async (t) => {
  const project = await setupProject('export-fns');
  const exports = await describeDts(project);

  t.assert(exports.find(({ name }) => name === 'fn1'));
  t.assert(exports.find(({ name }) => name === 'fn2'));
});

// TODO this doesn't work at the moment
test.skip('export default object', async (t) => {
  const project = await setupProject('export-default-obj');
  const exports = await describeDts(project);

  t.assert(exports.find(({ name }) => name === 'default'));
});
