// This job takes a random number of seconds and returns a random number
const slowmo = (state) => new Promise((resolve) => {
  const done = () => {
    resolve({ data: { result: Math.random() * 100 }})
  };
  setTimeout(done, state.configuration?.delay ?? 500);
});

export default [slowmo];