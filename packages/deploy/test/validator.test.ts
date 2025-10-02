import mock from 'mock-fs';
import test from 'ava';
import { parseAndValidate } from '../src/validator';

function findError(errors: any[], message: string) {
  return errors.find((e) => e.message === message);
}

test.after(() => {
  mock.restore();
});

test('Workflows must be a map', async (t) => {
  const doc = `
    name: project-name
    workflows:
      - name: workflow-one
      - name: workflow-two
    `;

  const results = await parseAndValidate(doc, 'spec.yaml');

  const err = findError(results.errors, 'must be a map');

  t.truthy(err);
  t.is(err.path, 'workflows');
});

test('Workflows must have unique ids', async (t) => {
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

  const results = await parseAndValidate(doc, 'spec.yaml');

  const err = findError(results.errors, 'duplicate id: workflow-one');
  t.truthy(err);
  t.is(err.path, 'workflow-one');
});

test('Jobs must have unique ids within a workflow', async (t) => {
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

  const results = await parseAndValidate(doc, 'spec.yaml');

  const err = findError(results.errors, 'duplicate id: foo');
  t.is(err.path, 'workflow-two/foo');
  t.truthy(err);
});

test('Job ids can duplicate across workflows', async (t) => {
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

  const results = await parseAndValidate(doc, 'spec.yaml');

  t.is(results.errors.length, 0);
});

test('Workflow edges are parsed correctly', async (t) => {
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

  const results = await parseAndValidate(doc, 'spec.yaml');

  t.assert(
    results.doc.workflows['workflow-one'].edges![
      'webhook->Transform-data-to-FHIR-standard'
    ].condition_expression === 'true'
  );
});

test('allow empty workflows', async (t) => {
  let doc = `
    name: project-name
  `;

  const result = await parseAndValidate(doc, 'spec.yaml');

  t.is(result.errors.length, 0);

  t.deepEqual(result.doc, {
    name: 'project-name',
    workflows: {},
  });
});

test('adds the file content into the job body from the specified path', async (t) => {
  // Step 1: Create a temporary file that the YAML will reference
  const fileContent = 'fn(state => state.data);';
  mock({
    '/jobBody.js': fileContent,
  });

  // Step 2: YAML document that references the file
  const doc = `
    name: project-name
    workflows:
      workflow-one:
        name: workflow one
        jobs:
          job-one:
            name: job one
            adaptor: '@openfn/language-http@latest'
            body:
              path: /jobBody.js
  `;

  // Step 3: Run the parseAndValidate function
  const results = await parseAndValidate(doc, 'spec.yaml');

  // Step 4: Assert that the content from the file was merged into the spec
  const jobBody = results.doc.workflows['workflow-one'].jobs!['job-one'].body;

  t.is(jobBody.content, fileContent);
});
