type System = import('typescript').System;

let hasLocalStorage = false;
try {
  hasLocalStorage = typeof localStorage !== `undefined`;
} catch (error) {}

const hasProcess = typeof process !== `undefined`;

const shouldDebug =
  (hasLocalStorage && localStorage.getItem('DEBUG')) ||
  (hasProcess && process.env.DEBUG);

const debugLog = shouldDebug
  ? console.log
  : (_message?: any, ..._optionalParams: any[]) => '';

function notImplemented(methodName: string): any {
  throw new Error(`Method '${methodName}' is not implemented.`);
}
//
// "/DOM.d.ts" => "/lib.dom.d.ts"
const libize = (path: string) => path.replace('/', '/lib.').toLowerCase();

function audit<ArgsT extends any[], ReturnT>(
  name: string,
  fn: (...args: ArgsT) => ReturnT
): (...args: ArgsT) => ReturnT {
  return (...args) => {
    const res = fn(...args);

    const smallres = typeof res === 'string' ? res.slice(0, 80) + '...' : res;
    debugLog('> ' + name, ...args);
    debugLog('< ' + smallres);

    return res;
  };
}

export function createSystem(files: Map<string, string>): System {
  return {
    args: [],
    createDirectory: () => notImplemented('createDirectory'),
    directoryExists: audit('directoryExists', (directory) => {
      return Array.from(files.keys()).some((path) =>
        path.startsWith(directory)
      );
    }),
    exit: () => notImplemented('exit'),
    fileExists: audit(
      'fileExists',
      (fileName) => files.has(fileName) || files.has(libize(fileName))
    ),
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    getExecutingFilePath: () => notImplemented('getExecutingFilePath'),
    readDirectory: audit('readDirectory', (directory) =>
      directory === '/' ? Array.from(files.keys()) : []
    ),
    readFile: audit(
      'readFile',
      (fileName) => files.get(fileName) || files.get(libize(fileName))
    ),
    resolvePath: (path) => path,
    newLine: '\n',
    useCaseSensitiveFileNames: true,
    write: () => notImplemented('write'),
    writeFile: (fileName, contents) => {
      files.set(fileName, contents);
    },
  };
}
