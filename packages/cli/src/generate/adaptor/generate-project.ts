/**
 * This fella will generate an adaptor project stub into an empty directory
 * 
 */

type Files {
  [path: string]: string
}

const generatePkg = (name: string) => JSON.stringify({
  // TODO how much monorepo boilerplate do we really need?
  // Should not the mono repo provide this, and we call it to generate the stub?
  // what if you're not generating in the monorepo?

  // OK so this will be a very minimal package.json, just for now
  "name": `@openfn/language-${name}`,
  "version": "1.0.0",
  "description": "",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "author": "Open Function Group",
  "license": "LGPLv3",
  "files": [
    "dist/",
    "types/",
    "ast.json",
    "configuration-schema.json"
  ],
  "dependencies": {
    "@openfn/language-common": "^1.12.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/openfn/adaptors.git"
  },
}, null, 2);

const generate = (name:string,  path: string, files: Files = {}) => {

  // TODO throw or warn if path/name exists

  // create root door "name"

  // ensure that some key paths are set
  if (!files['src/index.js']) {
    files['src/index.js'] = `import * as Adaptor from './Adaptor';
    export default Adaptor;
    
    export * from './Adaptor';`
  }

  if (!files['src/Adaptor.js']) {
    files['src/Adaptor.js'] = `import { fn } from "@openfn/language-common";
    
    export { fn };`
  }

  if (!files['package.json']) {
    files['package.json'] = generatePkg(name)
  }

  // TODO there's loads we need todo here tbh
  // license, readme, maybe eslintrc
  // I really think this functionality should mostly move to adaptors,
  // where we'll generate a stub

  // If you ask for codegen without the monorepo, we'll jsut emit stub files

  // generate each path

}

export default generate