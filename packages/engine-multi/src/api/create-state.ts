export default (plan) => ({
  id: plan.id,
  status: 'pending',
  plan,

  threadId: undefined,
  startTime: undefined,
  duration: undefined,
  error: undefined,
  result: undefined,

  // yeah not sure about options right now
  // options: {
  //   ...options,
  //   repoDir,
  // },
});
