// Guards against shell injection when a module specifier (or path) is
// interpolated into an npm command passed to child_process.exec

// Whitespace splits arguments; the metacharacters below allow command
// chaining (; & |), substitution ($ ` ( )), redirection (< >) or escaping (\)
const UNSAFE_CHARS = /[\s;&|`$()<>\\]/;

const assertSafeSpecifier = (specifier: string) => {
  if (typeof specifier !== 'string' || UNSAFE_CHARS.test(specifier)) {
    throw new Error(`Unsafe module specifier: ${specifier}`);
  }
};

export default assertSafeSpecifier;
