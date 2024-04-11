import test from 'ava';
import { createStep, createWorkflow } from '../util';
import fuzzyMatchStart from '../../src/util/fuzzy-match-start';

const workflow = createWorkflow([
  createStep({ id: 'sf', name: 'get from salesforce' }),
  createStep({ id: 'pri', name: 'get from primero' }),
  createStep({ id: 'transform-salesforce', name: 'transform salesforce data' }),
  createStep({ id: 'err', name: 'report salesforce error' }),
]);

test('do nothing if no start provided', (t) => {
  const result = fuzzyMatchStart(workflow);

  t.falsy(result);
});

test('match an exact id', (t) => {
  const result = fuzzyMatchStart(workflow, 'transform-salesforce');

  t.is(result, 'transform-salesforce');
});

test('fuzzy match an id', (t) => {
  const result = fuzzyMatchStart(workflow, 'orm-sal');

  t.is(result, 'transform-salesforce');
});

test('fuzzy match a name', (t) => {
  const result = fuzzyMatchStart(workflow, 'from salesforce');

  t.is(result, 'sf');
});

test('exact match a name', (t) => {
  const result = fuzzyMatchStart(workflow, 'transform salesforce data');

  t.is(result, 'transform-salesforce');
});

test('throw if results are ambiguous (name and id)', (t) => {
  t.throws(() => fuzzyMatchStart(workflow, 'salesforce'), {
    message: 'AMBIGUOUS_INPUT',
  });
});

test('throw if results are ambiguous (name)', (t) => {
  t.throws(() => fuzzyMatchStart(workflow, 'from'), {
    message: 'AMBIGUOUS_INPUT',
  });
});

test('throw if the start is not found', (t) => {
  t.throws(() => fuzzyMatchStart(workflow, 'magneto'), {
    message: 'NOT_FOUND',
  });
});
