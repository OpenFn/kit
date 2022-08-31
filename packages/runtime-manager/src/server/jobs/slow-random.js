// This job takes a random number of seconds and returns a random number
import { fn } from '@openfn/language-common'

fn((state) => 
  new Promise((resolve) => {
    const done = () => {
      resolve({ data: { result: Math.random() * 100 }})
    };
    const delay = state && state.configuration && state.configuration.delay;
    setTimeout(done, delay || 500);
  })
);