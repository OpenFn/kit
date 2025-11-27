import { SerializedProject } from '../../src/parse/from-project';

// TODO add some texture to this
// more openfn opts, more realistic values

export const json: SerializedProject = {
  id: 'my-project',
  name: 'My Project',
  version: 2,
  description: 'my lovely project',
  openfn: {
    uuid: '1234',
    endpoint: 'https://app.openfn.org',
  },
  options: {
    allow_support_access: false,
  },
  workflows: [
    {
      steps: [
        {
          name: 'a',
          id: 'a',
          openfn: {
            uuid: 2,
          },
          next: {
            b: {
              openfn: {
                uuid: 4,
              },
            },
          },
        },
        {
          name: 'b',
          id: 'b',
          openfn: {
            uuid: 3,
          },
        },
      ],
      name: 'Workflow',
      id: 'workflow',
      history: [],
      openfn: {
        uuid: 1,
      },
    },
  ],
};

export const yaml = `id: my-project
name: My Project
version: 2
description: my lovely project
openfn:
  uuid: "1234"
  endpoint: https://app.openfn.org
options:
  allow_support_access: false
workflows:
  - steps:
      - name: a
        id: a
        openfn:
          uuid: 2
        next:
          b:
            openfn:
              uuid: 4
      - name: b
        id: b
        openfn:
          uuid: 3
    name: Workflow
    id: workflow
    openfn:
      uuid: 1
    history: []
`;
