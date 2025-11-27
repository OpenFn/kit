import { yamlToJson } from './yaml';

// Ensure this state representation is JSON
// If it's a string, it'll try to work out if it's a json or yaml string
// always returns json
export default <T>(obj: any): T => {
  if (typeof obj === 'string') {
    const firstChar = obj.trim()[0];
    if (firstChar === '{' || firstChar === '[') {
      return JSON.parse(obj);
    } else {
      return yamlToJson(obj);
    }
  }
  return obj;
};
