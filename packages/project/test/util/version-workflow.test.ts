import test from 'ava';
import { generateHash } from '../../src/util/version';
import { generateWorkflow } from '../../src';

// TODO just caught a bug with both of these - needs to add tests around this
test.todo('include edge label in hash');
test.todo('include edge expression in hash');

// TODO this has started failing but I don't see why te has hshould have changed?
// maybe a null got removed?
test.only('generate an 12 character version hash for a basic workflow', (t) => {
  const workflow = generateWorkflow(
    `
    @name a
    @id some-id
    webhook-transform_data(name="Transform data",expression="fn(s => s)")
    `
  );
  console.log(JSON.stringify(workflow));
  const hash = workflow.getVersionHash();
  t.log(hash);
  t.is(hash, 'cli:7e5ca7843721');
});

test('unique hash but different steps order', (t) => {
  const workflow1 = generateWorkflow(
    `
    @name same-workflow
    @id id-one
    a-b
    b-c
    `
  );
  const workflow2 = generateWorkflow(
    `
    @name same-workflow
    @id id-two
    a-c
    c-b
    `
  );

  // different order of nodes (b & c changed position) but should generate the same hash
  // validate second step is actually different
  t.is(workflow1.steps[1].name, 'b');
  t.is(workflow2.steps[1].name, 'c');
  // assert that hashes are the same
  t.is(generateHash(workflow1), generateHash(workflow2));
});

/**
 *
 * different name/adaptor/credential/expression should generate different hash
 * Other keys should be ignored
 *
 * key order doesn't matter (arbitrary order, sort, inverse sort)
 *
 * include a prefix
 */

test('hash changes when workflow name changes', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-2
    @id workflow-id 
    a-b
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

// can't get credentials to work in the generator, need to fix that
test.skip('hash changes when credentials field changes', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1
    @credentials cred-1
    @id workflow-id 
    a-b
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @credentials cred-2
    @id workflow-id 
    a-b
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test("hash changes when a step's adaptor changes", (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b(adaptor=http)
    b-c
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b(adaptor=common)
    b-c
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test("hash changes when a step's expression changes", (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b
    b-c(expression="x=1")
    `
  );
  const wf2 = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    a-b
    b-c(expression="x=2")
    `
  );
  t.not(generateHash(wf1), generateHash(wf2));
});

test('ignored fields do not affect hash', (t) => {
  const wf1 = generateWorkflow(
    `
    @name wf-1 
    @id workflow-id 
    a-b
    b-c(expression="x=1")
    `
  );
  const wf1_ignored = generateWorkflow(
    `
    @name wf-1
    @id workflow-id 
    @unknownfield some-value
    a-b
    b-c(expression="x=1")
    `
  );
  t.is(generateHash(wf1), generateHash(wf1_ignored));
});
