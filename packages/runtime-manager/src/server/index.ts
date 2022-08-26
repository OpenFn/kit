import koa from 'koa';
import fs from 'node:fs/promises';
import path from 'node:path';
import Manager from '../Manager';

const loadJobs = async () => {
  for (const name of ['slow-random']) {
    const source = await fs.readFile(path.resolve(`src/server/jobs/${name}.js`), { encoding: 'utf8' });
    runtime.registerJob(name, source);
  }
  console.log('Jobs loaded:')
  console.log(runtime.getRegisteredJobs());
};

const app = new koa();

console.log('starting server')

const runtime = Manager();

loadJobs();

// Create http server
// GET works return  alist of workers

// on post to job/name we run that job

// need a web socket to listen to and report changes

const handlePost = (ctx: koa.Context) => {
  ctx;
  // start a job
  runJob('slow-random')
};

const runJob = async (name: string) => {
  console.log(`Starting job: ${name}...`)
  
  const result = await runtime.run(name, {
    configuration: {
      delay: 4000
    }
  });

  // console.log('--')
  console.log(`Job ${name} finished`)
  console.log(result)
  // console.log('--')
  report();
}

const report = () => {
  const jobs = runtime.getActiveJobs();
  const oldJobs = runtime.getCompletedJobs();
  console.log('---')
  console.log(`completed jobs: ${oldJobs.length}`) 
  console.log(`active jobs (${jobs.length}):`) 
  for (const job of jobs) {
    console.log(` [${job.id}] ${job.name}: (thread: ${job.threadId})`)
  }
  console.log('---')
}

app.use((ctx) => {
  if (ctx.method === "POST") {
    handlePost(ctx);
  }
})

app.listen(1234)

report();

export default {}