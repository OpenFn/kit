import test from 'ava';
import { MockAgent, setGlobalDispatcher } from 'undici';
import run from '../src/run';
import { generateProject } from '@openfn/project';

// quite a lot I need to do here
// I need to easily create projects with gen project
// i need a file system to pull to
// i need a mock server

// this should all be against v2 files

// set up a mock server
// with some data
let mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

let serverid = 0;

const createMockServer = (data) => {
  let projects = {};
  projects[data.id] = data;

  const endpoint = `http://lightning-${++serverid}`;

  const getProject = (id) => projects[id];
  const setProject = (data) => {
    projects[data.id] = data;
  };
  const mockPool = mockAgent.get(endpoint);
  mockPool
    .intercept({
      path: /api\/provision\/(.+)/,
      method: 'GET',
    })
    .reply((args) => {
      const id = args.path.split('/').at(-1);
      const data = getProject(id);
      return {
        data,
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      };
    })
    .persist();

  mockPool
    .intercept({
      path: /api\/provision/,
      method: 'POST',
    })
    .reply((args) => {
      const data = JSON.parse(args.body);
      setProject(data);
      return {
        statusCode: 200,
      };
    })
    .persist();

  return {
    add: setProject,
    endpoint,
    destroy: () => {
      mockPool.destroy();
    },
  };
};

test('server test', async (t) => {
  const { endpoint, destroy } = createMockServer({ id: 'x' });
  const response = await fetch(`${endpoint}/api/provision/x`);
  const project = await response.json();
  t.deepEqual(project, { id: 'x' });

  await fetch(`${endpoint}/api/provision`, {
    method: 'POST',
    body: JSON.stringify({ id: 'x', name: 'test' }),
    headers: {
      'content-type': 'application-json',
    },
  });

  const response2 = await fetch(`${endpoint}/api/provision/x`);
  const project2 = await response2.json();
  t.deepEqual(project2, { id: 'x', name: 'test' });
  destroy();
});

test.skip('fetch a project', async (t) => {
  const workspace = 'tmp/a';

  // generate a project
  const project = generateProject('patients', ['trigger-job'], {
    openfnUuid: true,
  });
  const state = project.serialize('state');
  // get its statefile
  // add to the server
  const { endpoint, destroy, add } = createMockServer({ id: 'x' });
  add(state);

  // now run cli fetch
  // this fails because its running out of process, so the mock server
  // isnt running
  // i think?
  const { stdout } = await run(
    `openfn project fetch \
       --workspace ${workspace} \
       --endpoint ${endpoint} \
       --api-key abc \
       --log debug \
       ${project.openfn.uuid}`
  );

  console.log(stdout);
  // now check that the filesystem is roughly right

  destroy();
});
