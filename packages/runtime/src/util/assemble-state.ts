const assembleData = (initialData: any, defaultData = {}) => {
  if (
    initialData &&
    (Array.isArray(initialData) || typeof initialData !== 'object')
  ) {
    return initialData;
  }

  return Object.assign({}, defaultData, initialData);
};

// Function to assemble state in between jobs in a workflow
const assembleState = (
  initialState: any = {}, // previous or initial state
  configuration = {},
  defaultState: any = {}, // This is default state provided by the job
  globalCredentials: any = {}
) => {
  const obj = {
    ...defaultState,
    ...initialState,
  };

  if (initialState.references) {
    obj.references = initialState.references;
  }

  if (initialState.errors) {
    obj.errors = initialState.errors;
  }

  Object.assign(obj, {
    configuration: Object.assign({}, globalCredentials, configuration),
    data: assembleData(initialState.data, defaultState.data),
  });

  return obj;
};

export default assembleState;
