// Shared setup for the sync tests
//
// ava runs test files in parallel, so each file gets its own mock Lightning
// (on its own port) and its own folder under tmp/sync

import path from 'node:path';
import fs from 'node:fs';
import type { ExecutionContext, TestFn } from 'ava';
import { generateProject } from '@openfn/project';
import createLightningServer from '@openfn/lightning-mock';
import { rimraf } from 'rimraf';
import run from '../../src/run';

export const setup = (test: TestFn, name: string, port: number) => {
  const root = path.resolve('tmp/sync', name);
  const endpoint = `http://localhost:${port}/api/provision`;

  const lightning: any = createLightningServer({ port });

  test.before(async () => {
    await rimraf(root);
  });

  // Each test works in its own workspace, named after the test
  const initWorkspace = (t: ExecutionContext) => {
    const id = t.title.replaceAll(' ', '_').toLowerCase();
    const workspace = path.resolve(root, id);

    return {
      workspace,
      read: (filePath: string) => {
        return fs.readFileSync(path.resolve(workspace, filePath), 'utf8');
      },
      // run a command against this workspace and server (and log it to the test output), without passing
      // --workspace, --endpoint or --api-key (the env is set for this command only)
      run: (cmd: string) => {
        t.log(`$ ${cmd}`);
        return run(cmd, {
          OPENFN_WORKSPACE: workspace,
          OPENFN_ENDPOINT: endpoint,
          OPENFN_API_KEY: 'abc',
          IGNORE_DOT_ENV: 'true',
        });
      },
    };
  };

  // generate a project and serve it from the mock Lightning
  const gen = (
    name = 'patients',
    workflows = ['trigger-job(expression="fn()")']
  ) => {
    const project = generateProject(name, workflows, {
      openfnUuid: true,
    });
    const state = project.serialize('state', { format: 'json' });
    lightning.addProject(state);
    return project;
  };

  return { lightning, endpoint, initWorkspace, gen };
};
