export default (error: any) => {
  return {
    message: error.message,
    // TODO this mapping is kinda crazy
    name: error.subtype || error.type,
    type: error.name,
    severity: error.severity || 'crash',
  };
};
