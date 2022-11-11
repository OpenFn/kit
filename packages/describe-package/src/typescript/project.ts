import ts from 'typescript';

import {
  // createDefaultMapFromNodeModules,
  createDefaultMapFromCDN,
  createVirtualTypeScriptEnvironment,
  VirtualTypeScriptEnvironment,
} from '@typescript/vfs';
import { createSystem } from '../fs/fake-fs';
import { WrappedSymbol } from './wrapped-symbol';

export async function getDefaultMap(): Promise<Map<string, string>> {
  const shouldCache = true;
  // This caches the lib files in the site's localStorage
  const fsMap = await createDefaultMapFromCDN(
    { target: Project.compilerOpts.target },
    '4.5.5',
    shouldCache,
    ts
  );

  return fsMap;
}

/**
 * Object for holding references to compiler components to make working with
 * the TypeScript compiler easier.
 *
 * - `system`
 *   The virtual filesystem allowing adding files in memory.
 * - `env`
 *   The TypeScript environment, where the files provided by the `system` are
 *   the source of truth.
 */
export class Project {
  fsMap: Map<string, string>;
  env: VirtualTypeScriptEnvironment;
  system: ts.System;
  transformers: Array<
    (program: ts.Program, options: {}) => ts.TransformerFactory<ts.SourceFile>
  >;
  transformOptions!: {};
  ts: typeof ts;

  constructor(fsMap: Map<string, string> = new Map()) {
    this.transformers = [];
    // You start with creating a map which represents all the files
    // in the virtual ts.System
    // this.fsMap = createDefaultMapFromNodeModules(BaseCompiler.compilerOpts, ts);

    this.fsMap = fsMap;
    this.ts = ts;

    // If you need a FS backed system, useful for debugging missing definitions.
    // const projectRoot = join(__dirname, "..");
    // this.system = createFSBackedSystem(fsMap, projectRoot, ts)
    this.system = createSystem(this.fsMap);
    this.env = createVirtualTypeScriptEnvironment(
      this.system,
      [],
      ts,
      Project.compilerOpts
    );
  }

  /**
   * Add the adaptors type definition to the compilers filesystem map
   * @param moduleName the name of the module that will be imported,
   * i.e. the adaptors name `@openfn/language-http`.
   * @param dts the .d.ts file as a string
   */
  addTypeDefinition(moduleName: string, dts: string) {
    const typedModulePath = moduleName.replace('@', '').replace('/', '__');

    this.fsMap.set(`/node_modules/@types/${typedModulePath}/index.d.ts`, dts);
    this.env.createFile(`${typedModulePath}.d.ts`, dts);
  }

  // addAdaptorFSMap(adaptorPackagePath: string) {
  //   addAdaptorFSMap(this.fsMap, adaptorPackagePath)
  // }

  // wrap(func: (sf: ts.SourceFile, ...args: any[]) => ts.SourceFile, ...args: any[]) {
  //   return func(this.sourceFile, ...args)
  // }

  public get program(): ts.Program {
    return this.env.languageService.getProgram()!;
  }

  public get sourceFile(): ts.SourceFile {
    return this.program.getSourceFile('index.ts')!;
  }

  public get typeChecker(): ts.TypeChecker {
    return this.program.getTypeChecker();
  }

  getSourceFile(filename: string): ts.SourceFile | undefined {
    return this.program.getSourceFile(filename);
  }

  /**
   * Add a file to the environment.
   *
   * Note that files added via the constructor are not considered part of the
   * 'project', rather files available for reading during diagnostics and
   * compilation. To add packages or type definitions use `addFile`.
   */
  createFile(expression: string, filename: string = 'index.ts'): ts.SourceFile {
    this.env.createFile(filename, expression);
    return this.getSourceFile(filename) as ts.SourceFile;
  }

  /**
   * Add a file to the system.
   *
   * Differs from `createFile` in that these files are not considered part of
   * the project - but part of the file system.
   */
  addToFS(mapOrContent: string | Map<string, string>, path?: string): void {
    if (path) {
      this.system.writeFile(path, mapOrContent as string);
    } else {
      for (const [path, content] of mapOrContent as Map<string, string>) {
        this.system.writeFile(path, content);
      }
    }
  }

  // useTransform(func: () => ts.TransformerFactory<ts.SourceFile>) {
  //   this.transformers.push(func)
  // }

  /**
   * Return a list of symbols that have been marked for export.
   * In the case of aliases (`export {a, b}`), these aliases are followed
   * to their original symbol.
   */
  getSymbol(sourceFile: ts.SourceFile): WrappedSymbol {
    const sfSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);
    if (!sfSymbol) {
      throw new Error('Expected a symbol for location of SourceFile');
    }

    return new WrappedSymbol(this.typeChecker, sfSymbol);
  }

  getDiagnostics(sourceFile?: ts.SourceFile): readonly ts.Diagnostic[] {
    return ts.getPreEmitDiagnostics(
      this.program,
      sourceFile || this.sourceFile
    );
  }

  formatDiagnostics(sourceFile?: ts.SourceFile): string[] {
    return this.getDiagnostics(sourceFile).map((diagnostic) => {
      if (diagnostic.file) {
        let { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start!
        );
        let message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        );
        return `${diagnostic.file.fileName} (${line + 1},${
          character + 1
        }): ${message}`;
      } else {
        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      }
    });
  }

  compile(sourceFile?: ts.SourceFile): ts.EmitResult {
    sourceFile = sourceFile || this.program.getSourceFile('index.ts');
    // const emitResult =
    return this.program.emit(
      sourceFile,
      this.system.writeFile,
      undefined,
      false,
      {
        before: this.transformers.map((t) =>
          t(this.program, this.transformOptions)
        ), // [transformer(this.program, {})],
        after: [],
        afterDeclarations: [],
      }
    );

    // return this.system.readFile("index.js")!;
  }

  static compilerOpts: ts.CompilerOptions = {
    allowJs: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.ES2020,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmitOnError: false,
    noUnusedLocals: true,
    noUnusedParameters: true,
    stripInternal: true,
    declaration: false,
    baseUrl: '/',
    // outDir: "/dist",
    lib: ['ES2020'],
    target: ts.ScriptTarget.ES2020,
  };

  // transform(): ts.TransformationResult<ts.Node> {
  //   const transformedSourceFile = ts.transform(
  //     this.sourceFile,
  //     [transformer(this.program, this.transformOptions)],
  //     BaseCompiler.compilerOpts
  //   )

  //   return transformedSourceFile
  //   // const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  //   // return printer.printFile(transformedSourceFile[0]);
  // }
}
