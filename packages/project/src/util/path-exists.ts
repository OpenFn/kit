import fs from 'fs';

export default function pathExists(fpath: string, type: 'file' | 'directory') {
  try {
    const stat = fs.statSync(fpath);
    if (type === 'file' && stat.isFile()) return true;
    else if (type === 'directory' && stat.isDirectory()) return true;
    return false;
  } catch (e) {
    return false; // maybe other types of errors
  }
}
