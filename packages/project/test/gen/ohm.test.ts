// TODO this should wholesale replace workflow-generator.test.ts
import test from 'ava';
import { grammar } from 'ohm-js';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import generateWorkflow from '../../src/gen/workflow-generator';

test.only('it should parse a simple workflow', (t) => {
  const result = generateWorkflow('a-b', { uuidSeed: 1 });
  t.log(JSON.stringify(result, null, 2));
  t.deepEqual(result, {
    steps: [
      {
        name: 'a',
        openfn: {
          uuid: 1,
        },
        next: {
          b: {
            openfn: {
              uuid: 3,
            },
          },
        },
      },
      {
        name: 'b',
        openfn: {
          uuid: 2,
        },
      },
    ],
  });
});

test('it should throw if parsing fails', (t) => {
  t.throws(() => generateWorkflow('a-'), {
    message: /parsing failed!/i,
  });
});

test('it should parse a simple workflow with leading space', (t) => {
  const result = parse(' a-b');
  t.true(result.succeeded());
});

test('it should parse a simple workflow with trailing space', (t) => {
  const result = parse('a-b ');
  t.true(result.succeeded());
});

test.skip("it should fail if there's a space on an edge", (t) => {
  const result = parse('a -b');
  t.false(result.succeeded());
});

test('it should parse a simple workflow with any letter', (t) => {
  const result = parse('x-y');
  t.true(result.succeeded());
});

test('it should parse a simple workflow with words, numbers and underscores', (t) => {
  const result = parse('node_1-_node_2_');
  t.true(result.succeeded());
});

// Come back to this later
test.skip('it should parse two node pairs', (t) => {
  const result = parse('a-b x-y');
  t.true(result.succeeded());
});

// Testing semantic actions
// Should I do all this together? I think so
test('it should parse and build a simple workflow', (t) => {
  const result = parse('a-b');
  t.true(result.succeeded());

  const adaptor = s(result);

  const wf = adaptor.buildWorkflow();
  t.log(wf);
});
