import { verify } from '../src/util/ensure-payload-size';
// this is 3mb of data
// (I'm using using docs.json from adaptors)
import data from './tmp/docs.json' with { type: 'json' };

const algo = process.argv[2] ?? 'stringify'

console.log('Running with algo', algo)

try {
  await verify(data, 0.1, algo as any)
} catch(e) {
  console.log(e)
  // do nothing
}
