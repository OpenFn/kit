import { ExecutionPlan } from '@openfn/runtime';
import crypto from 'node:crypto';

export const wait = (fn, maxAttempts = 100) =>
  new Promise<any>((resolve) => {
    let count = 0;
    let ival = setInterval(() => {
      count++;
      const result = fn() || true;
      if (result) {
        clearInterval(ival);
        resolve(result);
      }

      if (count == maxAttempts) {
        clearInterval(ival);
        resolve(null);
      }
    }, 100);
  });

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const waitForEvent = <T>(engine, eventName) =>
  new Promise<T>((resolve) => {
    engine.once(eventName, (e) => {
      resolve(e);
    });
  });

export const sleep = (delay = 100) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

export const createPlan = (...jobs) =>
  ({
    id: crypto.randomUUID(),
    jobs: [...jobs],
  } as ExecutionPlan);
