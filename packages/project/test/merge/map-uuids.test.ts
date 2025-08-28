import * as l from '@openfn/lexicon';

import test from 'ava';
import mapUUIDs from '../../src/merge/map-uuids';
import { createWorkflow } from '../util';
import generateWorkflow from './workflow-generator';

test('map triggers with the same name', (t) => {
  const source = generateWorkflow(['trigger']).setProp('trigger', {
    type: 'webhook',
  });
  const target = generateWorkflow(['trigger']).setProp('trigger', {
    type: 'webhook',
  });

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result, {
    ['trigger']: target.getId('trigger'),
  });
});

// map steps with the same name
// map edges with the same name

// map step with different id but same parent
// mark new step as new
// mark removed step as removed

test('node name changes but no positional change', (t) => {
  const source = generateWorkflow(['trigger-a', 'a-b']);
  const target = generateWorkflow(['trigger-c', 'c-b']);

  const result = mapUUIDs(source.workflow, target.workflow);

  t.deepEqual(result, {
    ['trigger']: target.getId('trigger'),
    ['b']: target.getId('b'),
    ['c']: null,
    ['a']: true,
  });
});

test('one connecting node missing', (t) => {
  const source = generateWorkflow(['a-b', 'b-c', 'b-d']);
  const target = generateWorkflow(['a-z', 'z-b', 'b-c', 'b-d']);

  const result = mapUUIDs(source.workflow, target.workflow);
  t.deepEqual(result, {
    ['a']: target.getId('a'),
    ['b']: target.getId('b'),
    ['c']: target.getId('c'),
    ['d']: target.getId('d'),
    ['z']: null,
  });
});
