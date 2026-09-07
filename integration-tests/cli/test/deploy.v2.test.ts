import test from 'ava';
import path from 'node:path';
import fs from 'node:fs/promises';
import run from '../src/run';
import createLightningServer, {
  DEFAULT_PROJECT_ID,
} from '@openfn/lightning-mock';
import Project, { jsonToYaml, yamlToJson } from '@openfn/project';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';
import {
  makeProject,
  makeMultiProject,
  makeProjectWithTwoJobs,
} from './fixtures/projects';

let server: ReturnType<typeof createLightningServer>;

const port = 8968;
const endpoint = `http://localhost:${port}`;

const tmpDir = path.resolve('tmp/deploy-v2');

test.before(async () => {
  server = await createLightningServer({ port });

  process.env.IGNORE_DOT_ENV = 'true';
  process.env.OPENFN_ENDPOINT = endpoint;
  process.env.OPENFN_WORKSPACE = tmpDir;
  process.env.OPENFN_API_KEY = 'test-key';
});

test.beforeEach(async () => {
  await rimraf(tmpDir);
  await fs.mkdir(tmpDir, { recursive: true });
});

test.serial('pull a project', async (t) => {
  const projectId = 'a';
  server.addProject(makeProject(projectId) as any);

  const { stdout, stderr } = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(stderr);

  assertLog(t, extractLogs(stdout), /Checked out project locally/i);

  const yaml = await fs.readFile(path.resolve(tmpDir, 'openfn.yaml'), 'utf8');
  t.regex(yaml, /uuid\: a/);
  t.regex(yaml, /id\: test-project/);
});

test.serial('pull, change and re-deploy', async (t) => {
  const projectId = 'aaaaaaaa';
  server.addProject(makeProject(projectId) as any);

  // pull the project to set up workspace
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  const yaml = await fs.readFile(path.resolve(tmpDir, 'openfn.yaml'), 'utf8');
  t.regex(yaml, /id\: test-project/);

  // modify expression to trigger a change
  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, deployed: true }))');

  // deploy
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);

  assertLog(t, extractLogs(stdout), /Updated project/);

  // validate the change on the server
  const proj = server.state.projects[projectId];
  t.regex(
    proj.workflows['my-workflow-1'].jobs['my-job'].body,
    /deployed\: true/
  );
});

test.serial('pull, change and re-deploy twice', async (t) => {
  const projectId = 'bbbbbbbb';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);

  // first deploy
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const first = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(first.stderr);
  assertLog(t, extractLogs(first.stdout), /Updated project/);

  // validate the change on the server
  let proj = server.state.projects[projectId];
  t.regex(proj.workflows['my-workflow-1'].jobs['my-job'].body, /v\: 1/);

  // second deploy after another update
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 2 }))');
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(
    t,
    logs,
    /This will make the following changes to the remote project:/
  );
  assertLog(t, logs, /My Workflow: changed/);
  assertLog(t, logs, /My Job:/gm);
  assertLog(t, logs, /- expression: \+1 lines/gm);

  proj = server.state.projects[projectId];
  t.regex(proj.workflows['my-workflow-1'].jobs['my-job'].body, /v\: 2/);
});

test.serial('deploy and pull to check version history', async (t) => {
  const projectId = 'cccccccc';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // pull and modify
  await run(`openfn project pull ${projectId} --log-json -l debug`);
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');

  // deploy then pull
  const { stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  await run(`openfn project pull ${projectId} --log-json -l debug`);

  // verify version history
  const projectFile = path.join(tmpDir, '.projects', 'main@localhost.yaml');
  const project = await Project.from('path', projectFile);
  const wf = project.workflows.find((w) => w.id === 'my-workflow');
  t.truthy(wf?.history);
  t.is(wf?.history.length, 1);
});

test.serial('deploy then pull, change one workflow, deploy', async (t) => {
  const projectId = 'dddddddd';
  server.addProject(makeMultiProject(projectId) as any);

  // pull multi workflow project
  const pullResult = await run(
    `openfn project pull ${projectId} --log-json -l debug`
  );
  t.falsy(pullResult.stderr);
  assertLog(t, extractLogs(pullResult.stdout), /Checked out project locally/i);

  // modify another-workflow
  const exprPath = path.join(
    tmpDir,
    'workflows/another-workflow/another-job.js'
  );
  await fs.writeFile(exprPath, "post('http://success.org')");

  // deploy
  const { stdout, stderr } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.falsy(stderr);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /Updated project/);

  // another-workflow should appear in the modified list
  const anotherLog = logs.find(
    (log) =>
      log.level === 'always' &&
      /Another Workflow: changed/.test(`${log.message}`)
  );
  t.truthy(anotherLog);

  // my-workflow shouldn't appear (not changed locally)
  const myWorkflowLog = logs.find(
    (log) =>
      log.level === 'always' && /^\s*-\s*my-workflow/.test(`${log.message}`)
  );
  t.falsy(myWorkflowLog);
});

/**
 *
 * 1. why is there no local version history?
 * 2. the remote change gets dropped in the merge
 *
 * I suspect the fail here is catching a real bug
 */
test.serial.skip(
  'only locally changed workflows are deployed when remote also changes',
  async (t) => {
    const projectId = 'eeeeeeee';
    server.addProject(makeMultiProject(projectId));

    // pull workflow
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    // update my-workflow remotely
    server.addNode(projectId, 'my-workflow-1', {
      name: 'New Job',
      adaptor: '@openfn/language-common@latest',
      body: 'fn(state => ({ ...state, remote: true }))',
    });

    // modify another-workflow locally
    const exprPath = path.join(
      tmpDir,
      'workflows/another-workflow/another-job.js'
    );
    await fs.writeFile(exprPath, "post('http://success.org')");

    // deploy
    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm  -l debug`
    );
    console.log(stdout);
    t.falsy(stderr);
    const logs = extractLogs(stdout);
    assertLog(t, logs, /Updated project/);

    const anotherLog = logs.find(
      (log) =>
        log.level === 'always' && /another-workflow/.test(`${log.message}`)
    );
    t.truthy(anotherLog);

    // TODO it fails to deploy the local changes to the server
    // console.log(JSON.stringify(server.state.projects[projectId], undefined, 2));
  }
);

test.serial('warn when local and remote workflows have diverged', async (t) => {
  const projectId = 'ffffffff';
  server.addProject(makeProject(projectId) as any);

  const exprPath = path.join(tmpDir, 'workflows/my-workflow/my-job.js');

  // base
  await run(`openfn project pull ${projectId} --log-json -l debug`);
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, v: 1 }))');
  const firstDeploy = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  assertLog(t, extractLogs(firstDeploy.stdout), /Updated project/);

  // remote changed from base
  const project = server.state.projects[projectId];
  const wf = Object.values(project.workflows as any).find(
    (w: any) => w.id === 'my-workflow-1'
  ) as any;
  server.updateWorkflow(projectId, {
    ...wf,
    jobs: Object.values(wf.jobs ?? {}).map((j: any) =>
      j.id === 'my-job-1'
        ? { ...j, body: 'fn(state => ({ ...state, remote: true }))' }
        : j
    ),
  });

  // local changed from base
  await fs.writeFile(exprPath, 'fn(s => ({ ...s, local: true }))');

  // deploy with divergence
  const { stdout, err } = await run(
    `openfn project deploy --no-confirm --log-json -l debug`
  );
  t.truthy(err);
  const logs = extractLogs(stdout);
  assertLog(t, logs, /have diverged/i);
  assertLog(t, logs, /Projects have diverged/i);
});

test.serial(
  'deploy collections: add a collection via openfn.yaml',
  async (t) => {
    const projectId = 'gggggggg';
    server.addProject(makeProject(projectId) as any);

    t.is(server.state.projects[projectId].collections.length, 0);

    // pull the project - no collections yet
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);
    assertLog(
      t,
      extractLogs(pullResult.stdout),
      /Checked out project locally/i
    );

    const openfnPath = path.resolve(tmpDir, 'openfn.yaml');
    const before: any = yamlToJson(await fs.readFile(openfnPath, 'utf8'));
    t.falsy(before.project.collections);

    // add a collection by hand - no workflow files are touched
    before.project.collections = ['my-collection'];
    await fs.writeFile(openfnPath, jsonToYaml(before));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);

    const logs = extractLogs(stdout);
    // a collections-only edit must still trigger a real deploy
    assertLog(t, logs, /Updated project/);

    const collections = server.state.projects[projectId].collections;
    t.is(collections.length, 1);
    t.is(collections[0].name, 'my-collection');
    t.truthy(collections[0].id);
    t.falsy(collections[0].delete);
  }
);

/**
 * These tests need organising better
 *
 * remoe all my notes
 *
 * we need to add forked_from for baseline comparisons
 *
 * Shouldn't that be done by the pull though?
 */

/**
 *
 * The merge drops the removed workflow from the local project, but nothing
 * tells the provisioner to actually delete it server-side - it only ever
 * upserts by id, so a workflow that's simply absent from the outgoing list
 * is never visited at all, and survives untouched. This is the same shape
 * of gap that deletedCollections() already solves for collections (see
 * packages/cli/src/projects/deploy.ts) - workflows need the equivalent.
 *
 * Note this does NOT extend to steps/edges within a workflow that's still
 * present - see the two tests below, which pass today, because an updated
 * workflow has its jobs/edges/triggers wholesale-replaced server-side
 * (lightning-mock's updateWorkflow does `{...existingWf, ...w}`), so a
 * dropped step or edge is naturally gone once the workflow itself updates.
 */

// this fails because of "nothing to deploy"
test.serial.only(
  'deploy: remove a workflow by deleting its local directory',
  async (t) => {
    const projectId = 'iiiiiiii';
    server.addProject(makeMultiProject(projectId) as any);

    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    // delete the whole workflow locally
    await rimraf(path.join(tmpDir, 'workflows/another-workflow'));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);
    console.log(stdout);
    assertLog(t, extractLogs(stdout), /Updated project/);

    const proj = server.state.projects[projectId];
    t.falsy(
      Object.values(proj.workflows as any).find(
        (w: any) => w.id === 'another-workflow-1'
      )
    );
    // the untouched workflow must survive
    t.truthy(
      Object.values(proj.workflows as any).find(
        (w: any) => w.id === 'my-workflow-1'
      )
    );
  }
);

/**
 *
 * Same underlying gap as workflow removal, one level down: mergeWorkflows()
 * in packages/project builds steps purely from source.steps, so a job
 * deleted locally just vanishes from the merged workflow with no delete
 * signal sent to the provisioner either. The job survives on the remote.
 */
test.serial(
  'deploy: remove a step (and its edge) via the workflow yaml',
  async (t) => {
    const projectId = 'jjjjjjjj';
    server.addProject(makeProjectWithTwoJobs(projectId) as any);

    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    const wfPath = path.resolve(
      tmpDir,
      'workflows/my-workflow/my-workflow.yaml'
    );
    const wf: any = yamlToJson(await fs.readFile(wfPath, 'utf8'));

    // drop the 'other-job' step entirely
    wf.steps = wf.steps.filter((s: any) => s.id !== 'other-job');
    // and the edge that used to point at it
    for (const step of wf.steps) {
      if (step.next?.['other-job']) delete step.next['other-job'];
    }
    await fs.writeFile(wfPath, jsonToYaml(wf));
    await fs.rm(path.join(tmpDir, 'workflows/my-workflow/other-job.js'), {
      force: true,
    });

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);
    assertLog(t, extractLogs(stdout), /Updated project/);

    const wfState: any = Object.values(
      server.state.projects[projectId].workflows as any
    ).find((w: any) => w.id === 'my-workflow-1');
    t.falsy(
      Object.values(wfState.jobs).find((j: any) => j.name === 'Other Job')
    );
    // the untouched job must survive
    t.truthy(Object.values(wfState.jobs).find((j: any) => j.name === 'My Job'));
  }
);

/**
 *
 * A narrower case than step removal: both jobs still exist, only the edge
 * connecting the trigger to 'other-job' is deleted locally. Same gap -
 * mergeWorkflows() only ever adds/updates edges found in source, it never
 * signals that a target-side edge should be removed.
 */
test.serial(
  'deploy: remove an edge without removing either step',
  async (t) => {
    const projectId = 'kkkkkkkk';
    server.addProject(makeProjectWithTwoJobs(projectId) as any);

    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);

    const wfPath = path.resolve(
      tmpDir,
      'workflows/my-workflow/my-workflow.yaml'
    );
    const wf: any = yamlToJson(await fs.readFile(wfPath, 'utf8'));

    // keep both steps, just drop the edge between the trigger and 'other-job'
    for (const step of wf.steps) {
      if (step.next?.['other-job']) delete step.next['other-job'];
    }
    await fs.writeFile(wfPath, jsonToYaml(wf));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);
    assertLog(t, extractLogs(stdout), /Updated project/);

    const wfState: any = Object.values(
      server.state.projects[projectId].workflows as any
    ).find((w: any) => w.id === 'my-workflow-1');
    // both jobs should still exist
    t.truthy(Object.values(wfState.jobs).find((j: any) => j.name === 'My Job'));
    t.truthy(
      Object.values(wfState.jobs).find((j: any) => j.name === 'Other Job')
    );
    // but the edge to 'other-job' must be gone
    t.falsy(
      Object.values(wfState.edges).find(
        (e: any) => e.target_job_id === wfState.jobs['other-job-1']?.id
      )
    );
  }
);

test.serial(
  'deploy collections: remove a collection via openfn.yaml',
  async (t) => {
    const projectId = 'hhhhhhhh';
    server.addProject({
      ...makeProject(projectId),
      collections: [{ id: 'coll-remove', name: 'my-collection' }],
    } as any);

    t.is(server.state.projects[projectId].collections.length, 1);

    // pull the project - openfn.yaml should list the fetched collection
    const pullResult = await run(
      `openfn project pull ${projectId} --log-json -l debug`
    );
    t.falsy(pullResult.stderr);
    assertLog(
      t,
      extractLogs(pullResult.stdout),
      /Checked out project locally/i
    );

    const openfnPath = path.resolve(tmpDir, 'openfn.yaml');
    const before: any = yamlToJson(await fs.readFile(openfnPath, 'utf8'));
    t.deepEqual(before.project.collections, ['my-collection']);

    // remove the collection by hand - no workflow files are touched
    before.project.collections = [];
    await fs.writeFile(openfnPath, jsonToYaml(before));

    const { stdout, stderr } = await run(
      `openfn project deploy --no-confirm --log-json -l debug`
    );
    t.falsy(stderr);

    const logs = extractLogs(stdout);
    // a collections-only edit must still trigger a real deploy
    assertLog(t, logs, /Updated project/);

    // the deleted collection should be gone from the project entirely
    t.is(server.state.projects[projectId].collections.length, 0);
  }
);
