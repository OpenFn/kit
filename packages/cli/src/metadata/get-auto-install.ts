const getAutoinstall = (adaptor: string): boolean => {

  if (adaptor.includes("=") || adaptor.startsWith("/") || !adaptor.length) {
    return false;
  }
  return true
};


export default getAutoinstall;
