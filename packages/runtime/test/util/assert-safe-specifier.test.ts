import test from 'ava';
import assertSafeSpecifier from '../../src/util/assert-safe-specifier';

test('allow a plain package name', (t) => {
  t.notThrows(() => assertSafeSpecifier('lodash'));
});

test('allow a scoped package name', (t) => {
  t.notThrows(() => assertSafeSpecifier('@openfn/language-http'));
});

test('allow a name and version specifier', (t) => {
  t.notThrows(() => assertSafeSpecifier('@openfn/language-http@1.2.3'));
});

test('allow the aliased install form', (t) => {
  t.notThrows(() =>
    assertSafeSpecifier('@openfn/language-http_1.2.3@npm:@openfn/language-http@1.2.3')
  );
});

test('allow a prerelease version', (t) => {
  t.notThrows(() => assertSafeSpecifier('my-pkg@1.0.0-beta.1'));
});

test('allow a filesystem path', (t) => {
  t.notThrows(() => assertSafeSpecifier('/home/user/openfn/repo/cli'));
});

// each of these should throw
const unsafe = [
  ['a space', 'lodash 4'],
  ['a semicolon', 'lodash;rm -rf /'],
  ['command chaining with &&', 'lodash&&whoami'],
  ['a pipe', 'lodash|cat'],
  ['a single ampersand', 'lodash&whoami'],
  ['a backtick', 'lodash`whoami`'],
  ['command substitution', 'lodash$(whoami)'],
  ['a dollar sign', 'lodash$HOME'],
  ['output redirection', 'lodash>/etc/passwd'],
  ['input redirection', 'lodash</etc/passwd'],
  ['an escape character', 'lodash\\x'],
  ['a newline', 'lodash\nwhoami'],
  ['a tab', 'lodash\twhoami'],
];

unsafe.forEach(([label, specifier]) => {
  test(`throw for ${label}`, (t) => {
    t.throws(() => assertSafeSpecifier(specifier), {
      message: /Unsafe module specifier/,
    });
  });
});

test('throw for a non-string specifier', (t) => {
  // @ts-ignore deliberately passing the wrong type
  t.throws(() => assertSafeSpecifier(undefined), {
    message: /Unsafe module specifier/,
  });
});
