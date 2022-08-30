import test from 'ava';

import parse from '../../src/parse';

// https://github.com/estree/estree/blob/master/es2015.md#exports

test('should add exports to an empty file', () => {
  // TOOD should I create trees using ast-types builders?
  // Or parsing right from source?
  // if I use the  builders, how do I know I've used them right?
  const ast = parse('')

  // export no exports statement

});