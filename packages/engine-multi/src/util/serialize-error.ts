export default (error: any) => {
  return {
    message: error.message,
    name: error.subtype || error.type || error.name,
    severity: error.severity || 'crash',
  };
};
