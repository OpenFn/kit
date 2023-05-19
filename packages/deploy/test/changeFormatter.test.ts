import test from 'ava';
import { diffString, diff } from 'json-diff';
import { fullExampleState } from './fixtures';
import jsonpatch from 'fast-json-patch';

const newProjectPatches = [
    {
      op: 'add',
      path: '/id',
      value: crypto.randomUUID(),
    },
    {
      op: 'add',
      path: '/name',
      value: 'project-name',
    },
    {
      op: 'add',
      path: '/workflows/workflow-one',
      value: {
        id: crypto.randomUUID(),
        name: 'workflow one',
        jobs: {
          'new-job': {
            name: 'new job',
            adaptor: '@openfn/language-adaptor',
            body: 'foo()',
          },
        },
        triggers: {
          'trigger-one': {
            type: 'cron',
          },
        },
        edges: {},
      },
    },
  ]

test('can render a pretty diff for a given patch', (t) => {
  const state = fullExampleState();
  const patches = [
    {
      op: 'add',
      path: '/workflows/workflow-one/edges/job-a->job-b/delete',
      value: true,
    },
  ];

  const patchedState = jsonpatch.applyPatch(
    state,
    patches,
    false,
    false
  ).newDocument;

  // console.log(JSON.stringify(patchedState, null, 2));

  console.log(diffString(state, patchedState));

  t.pass();
});


test("can render a set of text diffs for a set of path")
