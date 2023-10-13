function createNotifier(callback) {
  return (evt, payload) => {
    callback(evt, payload);
  };
}
