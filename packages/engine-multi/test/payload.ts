import { verify } from '../src/util/ensure-payload-size';

// this is 2.63mb of data
// (I'm using using docs.json from adaptors)
import data from './tmp/docs.json' with { type: 'json' };

// this is 16mb of data
// import data from './tmp/mtg-StandardAtomic.json' with { type: 'json' };

const algo = process.argv[2] ?? 'stringify'

console.log('Running with algo', algo)

try {
  await verify(data, 0.1, algo as any)
} catch(e) {
  console.log(e)
  // do nothing
}
