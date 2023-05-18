const assignDefault = (obj, d) => {
  for (const key in d) {
    if (!obj.hasOwnProperty(key)) {
      obj[key] = d[key];
    }
  }
  return obj;
};

// Function to assemble state in between jobs in a workflow
const assembleState = (
  initialState: any = {}, // previous or initial state
  configuration = {},
  defaultData = {}, // This is default data provided by the job
  strictState: boolean = true
) => {
  // const obj = strictState ? {} : { ...initialState };
  // We now assume initialState is an immer draft
  const obj = initialState;
  if (initialState.references) {
    obj.references = initialState.references;
  }
  if (initialState.errors) {
    obj.errors = initialState.errors;
  }
  Object.assign(obj, {
    configuration: Object.assign(
      {},
      initialState.configuration ?? {},
      configuration
    ),
    data: assignDefault(initialState.data || {}, defaultData),
  });
  return obj;
};

export default assembleState;
