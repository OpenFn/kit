// Function to assemble state in between jobs in a workflow
const assembleState = (
  initialState: any = {}, // previous or initial state
  configuration = {},
  defaultData = {}, // This is default data provided by the job
  strictState: boolean = true
) => {
  const obj = strictState ? {} : { ...initialState };
  if (initialState.references) {
    obj.references = initialState.references;
  }
  Object.assign(obj, {
    configuration: Object.assign(
      {},
      initialState.configuration ?? {},
      configuration
    ),
    data: Object.assign({}, defaultData, initialState.data),
  });
  return obj;
};

export default assembleState;
