import createLightningServer from './server';

const port = 8888;

createLightningServer({
  port,
});

console.log('Started mock Lightning server on ', port);
