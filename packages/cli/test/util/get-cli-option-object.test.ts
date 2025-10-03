import test from 'ava';
import getCLIOptionObject from '../../src/util/get-cli-option-object';

const FINAL_OBJECT = { arg1: 'arg1-value', arg2: 'arg2-value' };

test('normal yargs object', (t) => {
  const result = getCLIOptionObject({ arg1: 'arg1-value', arg2: 'arg2-value' });
  t.deepEqual(result, FINAL_OBJECT);
});

test('object in string form', (t) => {
  const result = getCLIOptionObject(
    '{"arg1":"arg1-value", "arg2": "arg2-value"}'
  );
  t.deepEqual(result, FINAL_OBJECT);
});

test('object as string literal', (t) => {
  const result = getCLIOptionObject('arg1=arg1-value,arg2=arg2-value');
  t.deepEqual(result, FINAL_OBJECT);
});
