// // helper function to run some code in a worker thread

// // when the child_process gets a run command
// // it basically needs to forward it on

// import process from 'node:process';

// // this guy receives the run message

// type TaskRegistry = Record<string, (...args: any[]) => Promise<any>>;

// type WorkerEvent = {
//   type: string;

//   [key: string]: any;
// };

// const tasks: TaskRegistry = {
//   // startup validation script
//   handshake: async () => true,
// };

// process.on('message', async (evt: WorkerEvent) => {
//   if (evt.type === 'engine:run_task') {
//     const args = evt.args || [];
//     run(evt.task, args);
//   }
// });

// export const register = (newTasks: TaskRegistry) => {
//   Object.assign(tasks, newTasks);
// };

// // spawn a worker thread
// // load the file
// // execute the function with the args
// // TODO forward jwt

// const run = (task: string, args: any[] = []) => {
//   // then in here

//   if (!tasks[task]) {
//     return process.send?.({
//       type: 'engine:reject_task',
//       error: {
//         severity: 'exception',
//         message: `task ${task} not found`,
//         type: 'TaskNotFoundError',
//       },
//     });
//   }

//   tasks[task](...args)
//     .then((result) => {
//       process.send?.({
//         type: 'engine:resolve_task',
//         result,
//       });
//     })
//     .catch((e) => {
//       process.send?.({
//         type: 'engine:reject_task',
//         error: {
//           severity: e.severity || 'crash',
//           message: e.message,
//           type: e.type || e.name,
//         },
//       });
//     });
// };
