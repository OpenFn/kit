import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import { randomUUID } from 'node:crypto';

const uuid = randomUUID;

// map triggers with the same name
// map steps with the same name
// map edges with the same name

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

  console.log(a);
  console.log(b);

  const result = mapUUIDs(a, b);

  t.deepEqual(result, {
    [id_a]: id_b,
  });
});
