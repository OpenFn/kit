fn((state) => {
  if (!state.data.count) {
    return {
      data: {
        count: 42,
      },
    };
  }
  state.data.count = state.data.count * 2;
  return state;
});
