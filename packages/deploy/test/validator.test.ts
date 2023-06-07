import test from 'ava';
import { parseAndValidate } from '../src/validator';

function findError(errors: any[], message: string) {
  return errors.find((e) => e.message === message);
}

test('validator', (t) => {
  let doc = `
name: project-name
workflows:
  - name: workflow-one
  - name: workflow-two
  `;

  let results = parseAndValidate(doc);

  t.truthy(
    results.errors.find((e) => e.message === 'workflows: must be a map')
  );

  doc = `
name: project-name
workflows:
  workflow-one:
    name: workflow one
  workflow-one:
    name: workflow two
    jobs:
      foo:
  workflow-three:
    name: workflow three
    jobs:
      foo:
  workflow-four:
    jobs:
      - 1
      - 2
  `;

  results = parseAndValidate(doc);

  t.truthy(findError(results.errors, 'duplicate key: workflow-one'));

  t.truthy(findError(results.errors, 'duplicate key: foo'));

  t.truthy(findError(results.errors, 'jobs: must be a map'));
});
