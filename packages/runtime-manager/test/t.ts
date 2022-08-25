import Manager from '../src/Manager';

const m = Manager();
m.registerJob('test', 'export default [() => 10];');
const result = await m.run('test');
console.log(result)