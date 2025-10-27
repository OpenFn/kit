import { getHeapStatistics } from 'node:v8';

function heap(reason) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  console.log(`>> [${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

const json = `{
  "id": "a",
  "triggers": [],
  "edges": [],
  "jobs": [
    {
      "id": "job1",
      "state": { "data": { "done": true } },
      "adaptor": "@openfn/language-common@1.7.7",
      "body": { "result": 42 }
    }
  ]
}
`;

heap('start');
const obj = JSON.parse(json);
heap('end');
