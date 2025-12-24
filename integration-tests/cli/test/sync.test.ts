import test from 'ava';
import path from 'node:path';
import fs from 'node:fs';
import run from '../src/run';
import { generateProject } from '@openfn/project';
import createLightningServer from '@openfn/lightning-mock';
import { rimraf } from 'rimraf';

let PORT = 5353;
let lightning;
const endpoint = `http://localhost:${PORT}/api/provision`;

test.before(async () => {
  await rimraf('tmp/sync');

  lightning = createLightningServer({
    port: PORT,
  });
});

const initWorkspace = (t: any) => {
  const id = t.title.replaceAll(' ', '_').toLowerCase();
  const p = path.resolve('tmp/sync', id);

  return {
    workspace: p,
    read: (filePath: string) => {
      return fs.readFileSync(path.resolve(p, filePath), 'utf8');
    },
  };
};

test('fetch a project', async (t) => {
  const { workspace, read } = initWorkspace(t);
  // generate a project
  const project = generateProject('patients', ['trigger-job'], {
    openfnUuid: true,
  });
  const state = project.serialize('state', { format: 'json' });
  lightning.addProject(state);

  const { stdout } = await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --log debug \
       ${project.openfn.uuid}`
  );

  // now check that the filesystem is roughly right
  const pyaml = read('.projects/main@localhost.yaml');

  t.regex(pyaml, /id: patients/);
  t.regex(pyaml, new RegExp(`uuid: ${project.openfn.uuid}`));
});
