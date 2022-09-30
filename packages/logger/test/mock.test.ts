import test from 'ava';

import mockLogger from '../src/mock';


let last: any = null;

const saveResult = (...args) => {
  last = args;
}

const logger = {
  info: saveResult,
  log: saveResult,
  debug: saveResult,
  error: saveResult,
  warn: saveResult,
  success: saveResult,
};

const mock = mockLogger({
  logger
});

test.beforeEach(() => {
  last = null;
});

test.serial('check the test harness works', (t) => {
  t.falsy(last);
  const workingMock = mockLogger({
    level: 'info',
    logger,
  });
  workingMock.info('x');
  t.truthy(last);
});

test.serial('info', (t) => {
  t.falsy(last);
  mock.info('x');
  t.falsy(last);
});

test.serial('debug', (t) => {
  t.falsy(last);
  mock.debug('x');
  t.falsy(last);
});

test.serial('error', (t) => {
  t.falsy(last);
  mock.error('x');
  t.falsy(last);
});

test.serial('warn', (t) => {
  t.falsy(last);
  mock.warn('x');
  t.falsy(last);
});

test.serial('log', (t) => {
  t.falsy(last);
  mock.log('x');
  t.falsy(last);
});