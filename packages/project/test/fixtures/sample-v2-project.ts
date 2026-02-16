import { SerializedProject } from '../../src/parse/from-project';

// TODO add some texture to this
// more openfn opts, more realistic values

export const json: SerializedProject = {
  id: 'my-project',
  name: 'My Project',
  description: 'my lovely project',
  cli: { version: 2 },
  openfn: { uuid: '1234', endpoint: 'https://app.openfn.org' },
  options: { allow_support_access: false, env: 'dev', color: 'red' },
  sandbox: {
    parentId: 'abcd',
  },
  workflows: [
    {
      steps: [
        {
          name: 'b',
          id: 'b',
          openfn: { uuid: 3, project_credential_id: 'x' },
          expression: 'fn()',
          adaptor: 'common',
        },
        {
          id: 'trigger',
          openfn: { uuid: 2 },
          type: 'webhook',
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
cli:
  version: 2
description: my lovely project
openfn:
  uuid: "1234"
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
          project_credential_id: x
        expression: fn()
        adaptor: common
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
