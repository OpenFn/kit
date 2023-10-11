import test from 'ava';

import createAPI from '../src/__api';

// thes are tests on the public api functions generally
// so these are very high level tests

// no need to test the event stuff - startworkflow etc
// maybe we can check the keys exist, although we'll quickly know if we dont

test.todo('execute');
test.todo('execute should return an event emitter');
test.todo('execute should proxy events');
test.todo('listen');
test.todo('log');

// test('callWorker', (t) => {
//   const api = createAPI();

//   t.pass();
// });
