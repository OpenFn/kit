import test from 'ava';

import { yamlToJson, jsonToYaml } from '../../src/util/yaml';

test('jsonToYaml: convert a basic object of primitives', (t) => {
  const obj = {
    str: 'hello world',
    num: 22,
    bool: true,
  };
  const yaml = `str: hello world
num: 22
bool: true
`;

  const result = jsonToYaml(obj);
  t.is(result, yaml);
});

test('jsonToYaml: convert an array of strings', (t) => {
  const obj = {
    arr: ['a', 'b', 'c'],
  };
  const yaml = `arr:
  - a
  - b
  - c
`;

  const result = jsonToYaml(obj);
  t.is(result, yaml);
});

test('jsonToYaml: convert an array of primitives', (t) => {
  const obj = {
    arr: ['1', '2', 3, true],
  };
  const expected = `arr:
  - "1"
  - "2"
  - 3
  - true
`;

  const result = jsonToYaml(obj);
  t.is(result, expected);
});

test('jsonToYaml: convert a nested object', (t) => {
  const obj = {
    o: {
      jam: 'jar',
    },
  };
  const yaml = `o:
  jam: jar
`;

  const result = jsonToYaml(obj);
  t.is(result, yaml);
});

test('yamlToJson: convert scalars into an object', (t) => {
  const yaml = `str: hello world
num: 22
bool: true`;
  const obj = {
    str: 'hello world',
    num: 22,
    bool: true,
  };

  const result = yamlToJson(yaml);
  t.deepEqual(result, obj);
});

// Taking the lazy option here
// the yaml library is really doing all the work for me
// what I should maybe do in this file is have an array of jsons and yamls
// and just test 2 way conversion automagically
test('yamlToJson: convert a workflow', (t) => {
  const yaml = `name: collections2
jobs:
  New-job:
    name: New job
    adaptor: "@openfn/language-common@latest"
    body: fn(s => s)
triggers:
  webhook:
    type: webhook
    enabled: true
edges:
  webhook->New-job:
    source_trigger: webhook
    target_job: New-job
    condition_type: always
    enabled: true
`;

  // TODO how worried are we about key ordering here?
  // everything seems to be alphabetical
  // it should not affect diffing
  // we could have a pretty-printer to handle ordering for us
  // ie, name first
  const obj = {
    edges: {
      'webhook->New-job': {
        condition_type: 'always',
        enabled: true,
        source_trigger: 'webhook',
        target_job: 'New-job',
      },
    },
    jobs: {
      'New-job': {
        adaptor: '@openfn/language-common@latest',
        body: 'fn(s => s)',
        name: 'New job',
      },
    },
    name: 'collections2',
    triggers: {
      webhook: {
        enabled: true,
        type: 'webhook',
      },
    },
  };

  const result = yamlToJson(yaml);
  t.deepEqual(result, obj);
});
