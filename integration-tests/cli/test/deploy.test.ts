import test from 'ava';
import run from '../src/run';
import createLightningServer, {
  DEFAULT_PROJECT_ID,
} from '@openfn/lightning-mock';
import { extractLogs, assertLog } from '../src/util';
import { rimraf } from 'rimraf';

// set up a lightning mock

let server: any;

const port = 8967;

const endpoint = `http://localhost:${port}`;

test.before(async () => {
  server = await createLightningServer({ port });
});

// This should fail against the built CLI right now
test.serial(
  `OPENFN_ENDPOINT=${endpoint} openfn pull ${DEFAULT_PROJECT_ID} --log-json`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);
    t.falsy(stderr);

    const stdlogs = extractLogs(stdout);
    assertLog(t, stdlogs, /Project pulled successfully/i);

    // TODO what's an elegant way to tidy up here?
    await rimraf('project.yaml');
    await rimraf('.state.json');
  }
);
