import { getHeapStatistics } from 'node:v8';

function heap(reason) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  console.log(`>> [${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

heap('start');
setTimeout(() => {
  heap('end');
}, 1000);
