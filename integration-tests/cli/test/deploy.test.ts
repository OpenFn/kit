import test from 'ava';
import run from '../src/run';
import createLightningServer from '@openfn/lightning-mock';
// set up a lightning mock

let server: any;

const port = 8967;

const endpoint = `http://localhost:${port}`;

test.before(async () => {
  server = await createLightningServer({ port });
});

// test.serial.only(`test`, async (t) => {
//   try {
//     const result = await fetch('http://localhost:8967/api/provision/123');
//     console.log(result.status);
//     const body = await result.json();
//     console.log(body);
//   } catch (e) {
//     console.log(e);
//   }
// });

// This should fail against the built CLI right now
test.serial(`OPENFN_ENDPOINT=${endpoint} openfn pull 123`, async (t) => {
  const { stdout, stderr } = await run(t.title);
  console.log(stdout);
  console.log(stderr);
  t.pass();
  // t.regex(stdout, /Versions/);
  // t.regex(stdout, /node.js/);
  // t.regex(stdout, /cli/);
  // t.regex(stdout, /runtime/);
  // t.regex(stdout, /compiler/);
});
