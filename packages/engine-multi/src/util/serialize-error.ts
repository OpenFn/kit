export default (error: any) => {
  return {
    message: error.message,
    name: error.subtype || error.name || error.type,
    type: error.name,
    severity: error.severity || 'crash',
  };
};
