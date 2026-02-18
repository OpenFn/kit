import test from 'ava';
import applyCredentialMap, {
  CREDENTIALS_KEY,
} from '../../src/execute/apply-credential-map';
import { createMockLogger } from '@openfn/logger/dist';

const fn = `const fn = (fn) => (s) => fn(s);
`;

const createWorkflow = (steps?: any[]) => ({
  workflow: {
    steps: steps ?? [
      {
        id: 'a',
        expression: `${fn}fn(() => ({ dat'admin@openfn.org-cred': { count: 42 } }));`,
        configuration: 'admin@openfn.org-cred',
        next: { b: true },
      },
    ],
  },
});

test('do nothing if map is undefined', (t) => {
  const wf = createWorkflow();
  delete wf.workflow.steps[0].configuration;

  applyCredentialMap(wf);

  t.falsy(wf.workflow.steps[0].configuration);
});

test('do nothing if map is empty', (t) => {
  const wf = createWorkflow();
  delete wf.workflow.steps[0].configuration;

  applyCredentialMap(wf, {});

  t.falsy(wf.workflow.steps[0].configuration);
});

test('apply a credential to a single step', (t) => {
  const wf = createWorkflow();
  const map = {
    'admin@openfn.org-cred': { user: 'Anne Arnold' },
  };

  t.is(wf.workflow.steps[0].configuration, 'admin@openfn.org-cred');

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, map['admin@openfn.org-cred']);
});

test('apply a credential to a single step if UUIDs are used', (t) => {
  const uuid = '4227ea57-6df9-4b6c-877f-04f00a6892b5';
  const wf = createWorkflow([
    {
      id: 'a',
      expression: `fn(s => s)`,
      configuration: uuid,
    },
  ]);
  const map = {
    [uuid]: { user: 'Anne Arnold' },
  };

  t.is(wf.workflow.steps[0].configuration, uuid);

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, map[uuid]);
});

test('apply a credential to a single step which already has config', (t) => {
  const wf = createWorkflow();
  wf.workflow.steps[0].configuration = { x: 1, [CREDENTIALS_KEY]: 'A' };
  const map = {
    'admin@openfn.org-cred': { user: 'Anne Arnold' },
  };

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, { ...map.A, x: 1 });
});

test('apply a credential to several steps', (t) => {
  const wf = createWorkflow([
    { id: 'a', configuration: 'admin@openfn.org-A' },
    { id: 'b', configuration: 'admin@openfn.org-B' },
  ]);
  const map = {
    'admin@openfn.org-A': { user: 'Anne Arnold' },
    'admin@openfn.org-B': { user: 'Belle Bellvue' },
  };

  t.is(wf.workflow.steps[0].configuration, 'admin@openfn.org-A');
  t.is(wf.workflow.steps[1].configuration, 'admin@openfn.org-B');

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, map['admin@openfn.org-A']);
  t.deepEqual(wf.workflow.steps[1].configuration, map['admin@openfn.org-B']);
});

test('wipe string credential if unmapped', (t) => {
  const wf = createWorkflow();

  t.truthy(wf.workflow.steps[0].configuration);

  applyCredentialMap(wf, {});

  t.falsy(wf.workflow.steps[0].configuration);
});

test('warn if credential unmapped', (t) => {
  const wf = createWorkflow();

  const logger = createMockLogger();
  t.truthy(wf.workflow.steps[0].configuration);

  applyCredentialMap(wf, {}, logger);

  t.truthy(
    logger._find('warn', /WARNING: credential IDs were found in the workflow/i)
  );
});
