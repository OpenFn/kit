import { SerializedProject } from '../../src/parse/from-project';

// TODO add some texture to this
// more openfn opts, more realistic values

export const json: SerializedProject = {
  id: 'my-project',
  name: 'My Project',
  schema_version: '4.0',
  description: 'my lovely project',
  openfn: { uuid: '1234', endpoint: 'https://app.openfn.org' },
  options: { allow_support_access: false, env: 'dev', color: 'red' },
  sandbox: {
    parentId: 'abcd',
  },
  credentials: [
    {
      uuid: 'x',
      owner: 'admin@openfn.org',
      name: 'My Credential',
    },
  ],
  workflows: [
    {
      steps: [
        {
          name: 'b',
          id: 'b',
          configuration: 'admin@openfn.org|My Credential',
          // TODO it's unclear why we have a type error here??
          // @ts-ignore
          openfn: { uuid: 3 },
          expression: 'fn()',
          adaptor: 'common',
        },
        {
          id: 'trigger',
          openfn: { uuid: 2 },
          type: 'webhook',
          // TODO it's unclear why we have a type error here??
          // @ts-ignore
          next: { b: { openfn: { uuid: 4 } } },
        },
      ],
      name: 'Workflow',
      id: 'workflow',
      openfn: { uuid: 1 },
      history: ['a', 'b'],
      start: 'trigger',
    },
  ],
};

export const yaml = `id: my-project
name: My Project
schema_version: '4.0'
description: my lovely project
credentials:
  - uuid: x
    owner: admin@openfn.org
    name: My Credential
openfn:
  uuid: '1234'
  endpoint: https://app.openfn.org
options:
  allow_support_access: false
  env: dev
  color: red
workflows:
  - steps:
      - id: b
        name: b
        openfn:
          uuid: 3
        expression: fn()
        adaptor: common
        configuration: admin@openfn.org|My Credential
      - id: trigger
        openfn:
          uuid: 2
        type: webhook
        next:
          b:
            openfn:
              uuid: 4
    name: Workflow
    id: workflow
    openfn:
      uuid: 1
    history:
      - a
      - b
    start: trigger
sandbox:
  parentId: abcd
`;
