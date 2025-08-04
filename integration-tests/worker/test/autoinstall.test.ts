import test from 'ava';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { generateKeys } from '@openfn/lightning-mock';

import { initLightning, initWorker } from '../src/init';
import { createRun, createJob } from '../src/factories';

const generate = (adaptor, version) => {
  const specifier = `@openfn/language-${adaptor}@${version}`;
  const job = createJob({
    body: `fn(() => ({ data: "${adaptor}" }))`,
    adaptor: specifier,
  });
  return createRun([], [job], []);
};

let lightning;
let worker;
let engine;

const run = async (attempt) => {
  return new Promise<any>(async (done, reject) => {
    lightning.on('run:complete', (evt) => {
      if (attempt.id === evt.runId) {
        done(lightning.getResult(attempt.id));
      }
    });

    lightning.enqueueRun(attempt);
  });
};

test.before(async () => {
  const repoDir = path.resolve('tmp/repo/autoinstall');

  try {
    await rm(repoDir, { recursive: true });
  } catch (e) {}

  const keys = await generateKeys();
  const lightningPort = 4321;

  lightning = initLightning(lightningPort, keys.private);

  ({ worker, engine } = await initWorker(
    lightningPort,
    {
      repoDir,
    },
    {
      runPublicKey: keys.public,
    }
  ));
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

test.serial('autoinstall a specific version', async (t) => {
  const a = generate('common', '1.7.7');

  let autoinstallEvent;

  engine.listen(a.id, {
    'autoinstall-complete': (evt) => {
      autoinstallEvent = evt;
    },
  });

  await run(a);

  t.is(autoinstallEvent.module, '@openfn/language-common');
  t.is(autoinstallEvent.version, '1.7.7');
});

// Lightning won't ever use this but it's good to validate the behaviour
test.serial('autoinstall @latest', async (t) => {
  const a = generate('testing', 'latest');

  let autoinstallEvent;

  engine.listen(a.id, {
    'autoinstall-complete': (evt) => {
      autoinstallEvent = evt;
    },
  });

  await run(a);

  t.is(autoinstallEvent.module, '@openfn/language-testing');
  // any 1.x version is fine for latest
  t.true(autoinstallEvent.version.startsWith('1.0.'));
});

test.serial('autoinstall @next', async (t) => {
  const a = generate('testing', 'next');

  let autoinstallEvent;

  engine.listen(a.id, {
    'autoinstall-complete': (evt) => {
      autoinstallEvent = evt;
    },
  });

  await run(a);

  t.is(autoinstallEvent.module, '@openfn/language-testing');
  // any 2.x version is fine for next
  t.true(autoinstallEvent.version.startsWith('2.0.'));
});

test.serial('autoinstall three things at once', async (t) => {
  const a = generate('common', '1.11.1');
  const b = generate('http', '7.2.0');
  const c = generate('googlesheets', '2.2.2');

  const [ra, rb, rc] = await Promise.all([run(a), run(b), run(c)]);

  t.is(ra.data, 'common');
  t.is(rb.data, 'http');
  t.is(rc.data, 'googlesheets');
});

test.skip('autoinstall stress test', async (t) => {
  const plans = [
    'mailchimp@0.3.0',
    'mailchimp@0.3.1',
    'mailchimp@0.3.2',
    'mailchimp@0.3.3',
    'mailchimp@0.3.4',
    'mailchimp@0.3.5',
    'mailchimp@0.4.1',
    'mailchimp@0.5.0',
    'mailchimp@0.6.0',
    'mailchimp@0.7.0',
    'mailchimp@0.7.1',
    'mailchimp@0.7.2',
    'http@4.2.2',
    'http@4.2.3',
    'http@4.2.4',
    'http@4.2.5',
    'http@4.2.6',
    'http@4.2.6',
    'http@4.2.8',
    'http@4.3.1',
    'http@4.3.2',
    'http@4.3.3',
    'http@5.0.0',
    'http@5.0.1',
    'http@5.0.2',
  ].map((v) => generate('mailchimp', v));
  await Promise.all(plans.map((p) => run(p)));
  t.pass('all good');
});
