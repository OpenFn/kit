import test from 'ava';

import { ModuleThread, spawn, Thread, BlobWorker } from 'threads';
import { WorkerAPI } from '../../src/worker/worker';
import { getDtsFixture } from '../helpers';
import { build } from 'esbuild';

const exampleDts = await getDtsFixture('language-common');

/**
 * Working around compilation issues with Threadjs and bundling it for nodejs.
 * There is some dynamic requires that switch between the nodejs and the browser
 * Worker implementations that appears to either not bundle the nodejs implementation
 * or doesn't correctly export it during runtime.
 */
async function buildAsString(filename) {
  let result = await build({
    entryPoints: [filename],
    sourcemap: 'inline',
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    platform: 'node',
    write: false,
    outdir: 'out',
    // Optional, appears to work without excluding node modules.
    external: ['node_modules/*'],
  });

  return result.outputFiles[0].contents;
}

let compiledBlob;
test.before(async function () {
  compiledBlob = await buildAsString('src/worker/worker.ts');
});

test('describeAdaptor creates and describes a dts file', async (t) => {
  t.timeout(8000);
  const blobWorker = new BlobWorker(compiledBlob);
  const worker = await spawn<WorkerAPI>(blobWorker);

  try {
    await worker.createProject();
    t.truthy(await worker.createProject());

    const adaptorExports = await worker.describeAdaptor(exampleDts);

    t.truthy(adaptorExports.find((sym) => sym.name == 'execute'));
    t.falsy(adaptorExports.find((sym) => sym.name == 'DataSource'));

    return Thread.terminate(worker);
  } catch (error) {
    if (worker) Thread.terminate(worker);
    throw error;
  }
});

test('loadModule', async function (t) {
  t.timeout(20000);
  const blobWorker = new BlobWorker(compiledBlob);
  const worker = await spawn<WorkerAPI>(blobWorker);

  try {
    await worker.createProject();
    await worker.loadModule('@openfn/language-common@2.0.0-rc1');

    const adaptorExports = await worker.describeDts(
      '/node_modules/@openfn/language-common/dist/language-common.d.ts'
    );
    t.truthy(adaptorExports.find((sym) => sym.name == 'execute'));
    t.falsy(adaptorExports.find((sym) => sym.name == 'DataSource'));

    await Thread.terminate(worker);
  } catch (e) {
    await Thread.terminate(worker);
    throw e;
  }
});
