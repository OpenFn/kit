import test from 'ava';
import applyCredentialMap from '../../src/execute/apply-credential-map';
import { createMockLogger } from '@openfn/logger/dist';

const fn = `const fn = (fn) => (s) => fn(s);
`;

const createWorkflow = (steps?: any[]) => ({
  workflow: {
    steps: steps ?? [
      {
        id: 'a',
        expression: `${fn}fn(() => ({ data: { count: 42 } }));`,
        // project_credential_id must map here
        // what about keychain_credential_id ?
        // Should we map to credential, rather than configuration? I don't think so
        configuration: 'A',
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
    A: { user: 'Anne Arnold' },
  };

  t.is(wf.workflow.steps[0].configuration, 'A');

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, map.A);
});

test('apply a credential to several steps', (t) => {
  const wf = createWorkflow([
    { id: 'a', configuration: 'A' },
    { id: 'b', configuration: 'B' },
  ]);
  const map = {
    A: { user: 'Anne Arnold' },
    B: { user: 'Belle Bellvue' },
  };

  t.is(wf.workflow.steps[0].configuration, 'A');
  t.is(wf.workflow.steps[1].configuration, 'B');

  applyCredentialMap(wf, map);

  t.deepEqual(wf.workflow.steps[0].configuration, map.A);
  t.deepEqual(wf.workflow.steps[1].configuration, map.B);
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

  t.truthy(logger._find('warn', /were not mapped/i));
});
