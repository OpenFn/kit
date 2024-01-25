//  Util function to parse a regex from a string
// supports abd, /abc/ and /abc/g formats

const parse = (str: string) => {
  let pattern = '';
  let flags = '';

  // Treat this as a full regex
  if (str.startsWith('/')) {
    const last = str.lastIndexOf('/');
    pattern = str.substring(1, last);
    flags = str.substring(last + 1);
  } else {
    pattern = str;
  }

  return new RegExp(pattern, flags);
};

export default parse;
