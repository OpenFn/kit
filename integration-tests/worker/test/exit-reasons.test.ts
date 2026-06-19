import test from 'ava';
import crypto from 'node:crypto';
import path from 'node:path';

import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.before(async () => {
  const lightningPort = 4321;

  lightning = initLightning(lightningPort);

  ({ worker } = await initWorker(lightningPort, {
    repoDir: path.resolve('tmp/repo/exit-reason'),
  }));
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

const run = async (attempt) => {
  return new Promise<any>(async (done) => {
    lightning.once('run:complete', (evt) => {
      if (attempt.id === evt.runId) {
        done(evt.payload);
      }
    });

    lightning.enqueueRun(attempt);
  });
};

test.serial('crash: syntax error', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: 'fn(() => throw "e")',
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'crash');
  t.is(error_type, 'CompileError');
  t.regex(error_message, /Unexpected token \(1:9\)$/);
});

// https://github.com/OpenFn/kit/issues/1045
test.serial('crash: reference error', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        name: 'x', // important!
        adaptor: '@openfn/language-common@latest',
        body: 'fn((s) => s.err.map(s => s))',
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'fail');
  t.is(error_type, 'RuntimeError');
  t.regex(
    error_message,
    /TypeError: Cannot read properties of undefined \(reading \'map\'\)/
  );
});

// https://github.com/OpenFn/kit/issues/758
test.serial('crash: job not found', async (t) => {
  lightning.addDataclip('x', {});

  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        id: 'x',
        adaptor: '@openfn/language-common@latest',
        body: 'fn(s => s)',
      },
    ],
    dataclip_id: 'x', // having a data clip is important to trigger the crash
    starting_node_id: 'y',
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'crash');
  t.is(error_type, 'ValidationError');
  t.regex(error_message, /could not find start job: y/i);
});

test.serial('exception: autoinstall error', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-worker-integration-tests@9.9.9',
        body: 'fn((s) => s)',
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;

  t.is(reason, 'exception');
  t.is(error_type, 'AutoinstallError');
  t.regex(
    error_message,
    /Error installing @openfn\/language-worker-integration-tests@9.9.9/
  );
});

test.serial('exception: bad credential (not found)', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: 'fn((s) => s)',
        credential: 'been-to-the-mountain', // the mock will return not_found
      },
    ],
  };

  const expectedLightningErrorResponse = {
    errors: { id: ['Credential not found!'] },
  };

  const result = await run(attempt);
  const { reason, error_type, error_message } = result;

  t.is(reason, 'exception');
  t.is(error_type, 'CredentialLoadError');
  t.is(
    error_message,
    `Failed to load credential been-to-the-mountain: [fetch:credential] ${JSON.stringify(
      expectedLightningErrorResponse
    )}`
  );
});

test.serial('exception: credential timeout', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: 'fn((s) => s)',
        credential: '%TIMEOUT%', // special mock key
      },
    ],
  };

  const result = await run(attempt);
  const { reason, error_type, error_message } = result;

  t.is(reason, 'exception');
  t.is(error_type, 'CredentialLoadError');
  t.is(
    error_message,
    'Failed to load credential %TIMEOUT%: [fetch:credential] timeout'
  );
});

test.serial('kill: oom (small, kill worker)', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: `fn((s) => {
          s.data = [];
          while(true) {
            s.data.push(new Array(1e6).fill("xyz"))
          }
        })`,
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'kill');
  t.is(error_type, 'OOMError');
  t.is(error_message, 'Run exceeded maximum memory usage');
});

// TODO this is failing locally... is it OK in CI?
test.serial('kill: oom (large, kill vm)', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: `fn((s) => {
          s.data = [];
          while(true) {
            s.data.push(new Array(1e9).fill("xyz"))
          }
        })`,
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'kill');
  t.is(error_type, 'OOMError');
  t.is(error_message, 'Run exceeded maximum memory usage');
});

test.serial('kill: state exceeds the configured state limit', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        // ~2mb string for a 1mb limit
        body: `fn((s) => {
          s.data = new Array(2 * 1024 * 1024).fill('a').join('');
          return s;
        })`,
      },
    ],
    options: {
      state_limit_mb: 1,
    },
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'kill');
  t.is(error_type, 'StateTooLargeError');
  t.regex(error_message, /State exceeds the limit of 1mb/);
});

test.serial(
  'kill: state limit is enforced between jobs (downstream job does not run)',
  async (t) => {
    const jobOne = {
      id: crypto.randomUUID(),
      adaptor: '@openfn/language-common@latest',
      // ~2mb state, over the 1mb limit set below
      body: `fn((s) => {
        s.data = new Array(2 * 1024 * 1024).fill('a').join('');
        return s;
      })`,
    };

    // not expected to run because the first job is expected to trigger state size crash
    const jobTwo = {
      id: crypto.randomUUID(),
      adaptor: '@openfn/language-common@latest',
      body: `fn(() => ({ data: 'ok' }))`,
    };

    const attempt = {
      id: crypto.randomUUID(),
      jobs: [jobOne, jobTwo],
      edges: [
        {
          id: crypto.randomUUID(),
          source_job_id: jobOne.id,
          target_job_id: jobTwo.id,
          condition: 'always',
        },
      ],
      options: {
        state_limit_mb: 1,
      },
    };

    const startedJobs: string[] = [];
    const unsubscribe = lightning.onSocketEvent(
      'step:start',
      attempt.id,
      (evt) => {
        if (evt.runId === attempt.id) {
          startedJobs.push(evt.payload.job_id);
        }
      },
      false
    );

    const result = await run(attempt);
    unsubscribe();

    const { reason, error_type, error_message } = result;
    t.is(reason, 'kill');
    t.is(error_type, 'StateTooLargeError');
    t.regex(error_message, /State exceeds the limit of 1mb/);

    t.deepEqual(startedJobs, [jobOne.id]);
  }
);

test.serial('crash: process.exit() triggered by postgres', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-postgresql@4.1.8', // version number is important
        body: "sql('select * from food_hygiene_interview');",
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;

  t.is(reason, 'crash');
  t.is(error_type, 'ExitError');
  t.regex(error_message, /Worker thread exited with code: 1/i);
});
