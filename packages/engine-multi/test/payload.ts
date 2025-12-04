import { verify } from '../src/util/ensure-payload-size';

// this is 3mb of data
// (I'm using using docs.json from adaptors)
import data from './tmp/docs.json' with { type: 'json' };

data;
// console.log(data.length)
verify(data, 10)
