import createLightningServer from './server';

const port = 8888;

createLightningServer({
  port,
});
console.log('Starting mock Lightning server on ', port);
