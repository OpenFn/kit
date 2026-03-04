// testing the dev API

// Tests of the REST API
import test from 'ava';

import { setup } from './util';

// @ts-ignore
let server: any;

const port = 3334;

test.before(async () => ({ server } = await setup(port)));

test('addProject: add a project from yaml', async (t) => {
  const yaml = `
id: my-project
name: My Project
cli:
  version: 2
openfn:
  uuid: "1234"
workflows:
  - name: wf
    steps:
      - id: a
        expression: fn()
        adaptor: "@openfn/language-common@latest"
        openfn:
          uuid: <a>
    history:
      - cli:ba19e179317f
    id: my-workflow
    start: webhook`;

  await server.addProject(yaml);

  const p = server.state.projects['1234'];
  t.is(p.id, '1234');
  t.truthy(p.workflows.wf);
  t.truthy(p.workflows.wf.jobs);
});
