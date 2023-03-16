// This will test both servers talking to each other
import test from 'ava';
import axios from 'axios';
import createRTMServer from '../src/server';
import createLightningServer from '../src/mock/lightning';

import { wait } from './util';

let lng;
let rtm;

const urls = {
  rtm: 'http://localhost:7777',
  lng: 'http://localhost:8888',
};

test.before(() => {
  lng = createLightningServer({ port: 8888 });
  rtm = createRTMServer({ port: 7777, lightning: urls.lng });
});

// TODO get this working
test.serial('should pick up a workflow in the queue', async (t) => {
  let found: false | string = false;

  rtm.on('workflow-start', (e) => {
    // console.log(e);
    found = e.workflowId;
  });

  lng.addToQueue('a');

  await wait(() => found);
  t.is(found as unknown as string, 'a');
});
