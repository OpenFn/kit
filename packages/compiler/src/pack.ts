import { fetchFile, fetchFileListing } from "./package-fs";

interface PackParameters {
  path: string;
  packageJson?: PackageJson;
  fileListing?: string[];
  fsMap?: Map<string, string>;
}

interface PackageJson {
  name: string;
  version: string;
  types: string;
}

export class Pack {
  path: string;
  _packageJson: PackageJson | undefined;
  _fileListing: string[] | undefined;
  fsMap: Map<string, string>;

  constructor(params: PackParameters) {
    this.path = params.path;
    this._packageJson = params.packageJson;
    this._fileListing = params.fileListing;
    this.fsMap = params.fsMap || new Map();
  }

  public get packageJson(): PackageJson {
    if (!this._packageJson) {
      throw new Error("packageJson not available.");
    }
    return this._packageJson;
  }

  public get fileListing(): string[] {
    if (!this._fileListing) {
      throw new Error("fileListing not available.");
    }
    return this._fileListing;
  }

  public get specifier(): string {
    return `${this.packageJson.name}@${this.packageJson.version}`;
  }

  public get version(): string {
    return this.packageJson.version;
  }

  async getFiles(files?: string[]) {
    Promise.allSettled((files || this.fileListing).map(this.getFile.bind(this)))
  }

  async getFile(file: string) {
    // TODO: change to allow FS fetching
    const contents = await fetchFile(this.specifier + file);
    this.fsMap.set(file, contents)
  }

  static async fromUnpkg(specifier: string): Promise<Pack> {
    const pack = new Pack({
      path: specifier,
      packageJson: JSON.parse(await fetchFile(specifier + "/package.json")),
      fileListing: Array.from(await fetchFileListing(specifier)),
    });

    return pack;
  }
}
