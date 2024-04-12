import test from 'ava';
import { getUpstreamStepId } from '../../src/util/load-state';
import { createWorkflow, createStep } from '../util';

// Low value test - we can just check order/priotity of args
// otherwise its mostly logging
test.todo('load state from stdin');

// Another low value test
// well covered in other places
test.todo('load state from path');

// I will write a couple of tests around this
test.todo('load cached state');

test('getUpstreamStepId: basic usage', (t) => {
  const workflow = createWorkflow([
    createStep({ id: 'a', next: { b: true } }),
    createStep({ id: 'b', next: { c: true } }),
    createStep({ id: 'c' }),
  ]);

  t.is(getUpstreamStepId(workflow, 'b'), 'a');
  t.is(getUpstreamStepId(workflow, 'c'), 'b');
});

test("getUpstreamStepId: don't blow up if now next", (t) => {
  const workflow = createWorkflow([
    createStep({ id: 'c' }),
    createStep({ id: 'a', next: { b: true } }),
    createStep({ id: 'b', next: { c: true } }),
  ]);

  t.is(getUpstreamStepId(workflow, 'b'), 'a');
  t.is(getUpstreamStepId(workflow, 'c'), 'b');
});

// TODO unsure at the moment how smart we need to be with this stuff
test.todo('getUpstreamStepId: ignore falsy values');
test.todo('getUpstreamStepId: ignore disabled edges');

test('getUpstreamStepId: hande string nexts', (t) => {
  const workflow = createWorkflow([
    createStep({ id: 'a', next: 'b' }),
    createStep({ id: 'b', next: 'c' }),
    createStep({ id: 'c' }),
  ]);

  t.is(getUpstreamStepId(workflow, 'b'), 'a');
  t.is(getUpstreamStepId(workflow, 'c'), 'b');
});
