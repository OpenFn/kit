import { fn } from '@openfn/language-common';
const x = fn((s) => s)({ data: {}, configuration: {} });
console.log(x);
export default './runtime';