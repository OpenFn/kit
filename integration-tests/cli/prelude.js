const isProd = process.env.NODE_ENV === 'production';

console.log();
console.log('== openfn CLI integration tests ==\n');
if (isProd) {
  console.log('Running tests in Production mode');
  console.log('Tests will use the global openfn command');
} else {
  console.log('Running tests in dev mode');
  console.log('Tests will use the local build in kit/packages/cli');
}
console.log();
