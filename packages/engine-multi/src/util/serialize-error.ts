export default (error: any) => {
  return {
    message: error.message,
    name: error.name,
    type: error.type,
    subtype: error.subtype,
    severity: error.severity || 'crash',
  };
};
