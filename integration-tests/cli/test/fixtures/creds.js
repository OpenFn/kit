fn((s) => {
  s.value = `${s.configuration.user}:${s.configuration.password}`;
  return s;
});
