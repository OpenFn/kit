fn((state = {}) => {
  if (!isNaN(state.data)) {
    return state.data * 2;
  }
  return 42;
});
