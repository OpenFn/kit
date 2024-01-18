export default (error: any) => {
  return {
    message: error.message,
    type: error.subtype || error.type || error.name,
    severity: error.severity || 'crash',
  };
};
