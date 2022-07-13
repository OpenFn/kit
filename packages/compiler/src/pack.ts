import { fetchFile, fetchFileListing } from "./package-fs";
import urlJoin from "url-join";

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

  /**
   * Get the "types" property from `package.json`, and ensure it's path is
   * relative to `/`.
   */
  public get types(): string {
    return urlJoin("/", this.packageJson.types)
  }

  async getFiles(files?: string[]) {
    await Promise.allSettled(
      (files || this.fileListing).map((file) => this.getFile(file))
    );

    return this.fsMap;
  }

  async getFile(file: string) {
    // TODO: change to allow FS fetching
    const contents = await fetchFile(this.specifier + file);
    this.fsMap.set(file, contents);
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
