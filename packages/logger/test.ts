console.log({ a: 10 })
console.log({ f: () => {} })
console.log({ fn: function() {} })

console.log({ a: 10, b: 20, c: 30, d: 40, e: 99999, f: 11111111111111111, aaaaaaaaaaaaaaaaAA: 22222222})

const a = {};
// circular ref
a.a = a;
console.log(a)