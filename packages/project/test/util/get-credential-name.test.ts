import test from 'ava';
import getCredentialName, { parse } from '../../src/util/get-credential-name';
import { Credential } from '../../src/Project';

test('should generate a credential name', (t) => {
  const cred: Credential = {
    uuid: '<uuid>',
    owner: 'admin@openfn.org',
    name: 'my credential',
  };

  const result = getCredentialName(cred);
  t.is(result, `admin@openfn.org|my credential`);
});

test('should parse credential name', (t) => {
  const { owner, name } = parse('admin@openfn.org|my credential');
  t.is(owner, 'admin@openfn.org');
  t.is(name, 'my credential');
});
