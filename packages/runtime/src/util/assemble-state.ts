// Function to assemble state in between jobs in a workflow
const assembleState = (
  initialState: any = {}, // previous or initial state
  configuration = {},
  defaultState: any = {}, // This is default state provided by the job
  strictState: boolean = true
) => {
  const obj = strictState
    ? {}
    : {
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
    configuration: Object.assign(
      {},
      initialState.configuration ?? {},
      configuration
    ),
    data: Object.assign({}, defaultState.data, initialState.data),
  });
  return obj;
};

export default assembleState;
