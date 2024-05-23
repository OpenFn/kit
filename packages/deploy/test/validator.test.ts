import test from 'ava';
import { parseAndValidate } from '../src/validator';

function findError(errors: any[], message: string) {
  return errors.find((e) => e.message === message);
}

test('Workflows must be a map', (t) => {
  const doc = `
    name: project-name
    workflows:
      - name: workflow-one
      - name: workflow-two
    `;

  const results = parseAndValidate(doc);

  const err = findError(results.errors, 'workflows: must be a map');

  t.truthy(err);
  t.is(err.path, 'workflows');
});

test('Workflows must have unique ids', (t) => {
  const doc = `
    name: project-name
    workflows:
      workflow-one:
        name: workflow one
      workflow-one:
        name: workflow two
      workflow-three:
        name: workflow three
  `;

  const results = parseAndValidate(doc);

  const err = findError(results.errors, 'duplicate id: workflow-one');
  t.truthy(err);
  t.is(err.path, 'workflow-one');
});

test('Jobs must have unique ids within a workflow', (t) => {
  const doc = `
    name: project-name
    workflows:
      workflow-two:
        name: workflow two
        jobs:
          foo:
          foo:
          bar:
    `;

  const results = parseAndValidate(doc);

  const err = findError(results.errors, 'duplicate id: foo');
  t.is(err.path, 'workflow-two/foo');
  t.truthy(err);
});

test('Job ids can duplicate across workflows', (t) => {
  const doc = `
    name: project-name
    workflows:
      workflow-one:
        name: workflow one
        jobs:
          foo:
      workflow-two:
        name: workflow two
        jobs:
          foo:
    `;

  const results = parseAndValidate(doc);

  t.is(results.errors.length, 0);
});

test('Workflow edges are parsed correctly', (t) => {
  const doc = `
    name: project-name
    workflows:
      workflow-one:
        name: workflow one
        jobs:
          Transform-data-to-FHIR-standard:
            name: Transform data to FHIR standard
            adaptor: '@openfn/language-http@latest'
            body: |
              fn(state => state);

        triggers:
          webhook:
            type: webhook
            enabled: true
        edges:
          webhook->Transform-data-to-FHIR-standard:
            condition_type: js_expression
            condition_expression: true
  `;

  const results = parseAndValidate(doc);

  t.assert(
    results.doc.workflows['workflow-one'].edges![
      'webhook->Transform-data-to-FHIR-standard'
    ].condition_expression === 'true'
  );
});

test('allow empty workflows', (t) => {
  let doc = `
    name: project-name
  `;

  const result = parseAndValidate(doc);

  t.is(result.errors.length, 0);

  t.deepEqual(result.doc, {
    name: 'project-name',
    workflows: {},
  });
});
