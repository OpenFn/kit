import { fetchFile, fetchFileListing } from "./package-fs";
import urlJoin from "url-join";

interface PackParameters {
  path: string;
  packageJson?: PackageJson;
  fileListing?: string[];
  fsMap?: Map<string, string>;
  packageBase?: string;
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
  _packageBase: string | undefined;

  constructor(params: PackParameters) {
    this.path = params.path;
    this._packageJson = params.packageJson;
    this._fileListing = params.fileListing;
    this.fsMap = params.fsMap || new Map();
    this._packageBase = params.packageBase;
  }

  public get packageJson(): PackageJson {
    if (!this._packageJson) {
      throw new Error("packageJson not available.");
    }
    return this._packageJson;
  }

  /**
   * The file contents of the package according to the source.
   *
   * _Different to `fsMap`, which includes the `root`._
   */
  public get fileListing(): string[] {
    if (!this._fileListing) {
      throw new Error("fileListing not available.");
    }
    return this._fileListing;
  }

  /**
   * The absolute name and version of the package.
   *
   * i.e. `@<org>/<package>@<version>`
   */
  public get specifier(): string {
    return `${this.packageJson.name}@${this.packageJson.version}`;
  }

  public get version(): string {
    return this.packageJson.version;
  }

  public get packageBase(): string {
    if (this._packageBase) {
      return this._packageBase;
    }

    this._packageBase = urlJoin("/node_modules", this.packageJson.name);
    return this.packageBase;
  }

  /**
   * Get the "types" property from `package.json`, and ensure it's path is
   * relative to `/`.
   */
  public get types(): string {
    return urlJoin(this.packageBase, this.packageJson.types);
  }

  async getFiles(files?: string[]) {
    await Promise.allSettled(
      (files || this.fileListing).map(this.getFile, this)
    );

    return this.fsMap;
  }

  async getFile(file: string) {
    // TODO: change to allow FS fetching
    const contents = await fetchFile(this.specifier + file);
    this.fsMap.set(urlJoin(this.packageBase, file), contents);
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
