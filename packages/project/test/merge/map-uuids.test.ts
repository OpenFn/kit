import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import { randomUUID } from 'node:crypto';

const uuid = randomUUID;

const wf = (steps = []): l.Workflow => ({
  name: 'wf1',
  steps,
});

test('map triggers with the same name', (t) => {
  const id_a = uuid();
  const id_b = uuid();
  const a = wf([
    {
      id: 'trigger',
      type: 'webhook',
      openfn: {
        enabled: true,
        id: id_a,
      },
    },
  ]);
  const b = wf([
    {
      id: 'trigger',
      type: 'webhook',
      openfn: {
        enabled: true,
        id: id_b,
      },
    },
  ]);

  t.log(JSON.stringify(a, null, 2));
  t.log(JSON.stringify(b, null, 2));

  const result = mapUUIDs(a, b);

  t.deepEqual(result, {
    [id_a]: id_b,
  });
});

// map steps with the same name
// map edges with the same name

// map step with different id but same parent
// mark new step as new
// mark removed step as removed

test('node name changes but no positional change', (t) => {
  const trigger_a = uuid();
  const trigger_b = uuid();

  const id_a = uuid();
  const id_b = uuid();

  const id_v = uuid();
  const id_bb = uuid();

  const a = wf([
    {
      id: 'trigger',
      type: 'webhook',
      next: {
        a: true
      },
      openfn: {
        enabled: true,
        id: trigger_a,
      },
    },
    {
      id: 'a',
      type: 'step',
      next: {b: true},
      openfn: {
        enabled: true,
        id: id_a,
      },
    },
    {
      id: 'b',
      type: 'step',
      openfn: {
        enabled: true,
        id: id_b,
      },
    },
  ]);
  const b = wf([
    {
      id: 'trigger',
      type: 'webhook',
      next: {v: true},
      openfn: {
        enabled: true,
        id: id_b,
      },
    },
    {
      id: 'v',
      type: 'step',
      next: {b: true},
      openfn: {
        enabled: true,
        id: id_v,
      },
    },
    {
      id: 'b',
      type: 'step',
      openfn: {
        enabled: true,
        id: id_bb,
      },
    },
  ]);

  t.log(JSON.stringify(a, null, 2));
  t.log(JSON.stringify(b, null, 2));

  const result = mapUUIDs(a, b);

  t.deepEqual(result, {
    [id_a]: id_v,
  });
});
