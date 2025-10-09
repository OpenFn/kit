import test from 'ava';
import mock from 'mock-fs';
import fromPath from '../../src/parse/from-path';

test('should load a v1 state json', async (t) => {
  mock({
    '/p1/main@openfn.org': JSON.stringify({
      id: 'wf1',
      name: 'wf1',
      steps: [
        {
          id: 'a',
          expression: 'job.js',
          next: {
            b: true,
          },
        },
        {
          id: 'b',
          expression: './job.js',
          next: {
            c: false,
          },
        },
      ], // TODO handle expressions too!
      // TODO maybe test the options key though
    }),
  });
  const project = await fromPath();

  t.deepEqual(project.repo, {
    workflowRoot: 'workflows',
    formats: { openfn: 'json', project: 'json', workflow: 'json' },
  });
});
