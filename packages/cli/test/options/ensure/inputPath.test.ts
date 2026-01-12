import test from 'ava';
import { inputPath, Opts } from '../../../src/options';

test('sets expressionPath using path', (t) => {
  const opts = {
    path: 'jam.js',
  } as Opts;

  inputPath.ensure!(opts);

  t.is(opts.expressionPath, 'jam.js');
});
