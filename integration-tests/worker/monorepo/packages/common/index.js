function fortyTwo() {
  return (state) => {
    state.data = 42;
    return state;
  };
}

module.exports = { fortyTwo };
