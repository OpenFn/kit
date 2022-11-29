/**
 * # Pack
 *
 * Object used to handle loading and querying module packages.
 *
 * Internally the file listing is kept without a directory prefix, and
 * all paths returned by `.types` and `.getFiles()` are prefixed by
 * `packageBase`. This allows a packages to be loaded from different sources
 * such as the local filesystem or from a CDN, and the resulting paths to mimic
 * a local filesystem.
 *
 * At a minimum, a Pack requires a `path`. A path is intended to represent
 * where to find the package - at present it is an npm style specifier
 * (e.g. `@myorg/mypackage@1.0.0`, or `mypackage`).
 *
 * While you can build a new Pack instance via the constructor, the easiest way
 * is to use the public methods.
 *
 * ## Loading from Unpkg
 *
 * ```js
 * const pack = await Pack.fetch("@myorg/mypackage")
 * ```
 *
 * This will create a new Pack instance and download it's `package.json` and
 * get a file listing.
 * Next in order to download all the files in a package you can use
 * `pack.getFiles()`, or pass in a list of files you want to be retrieved.
 *
 * ```js
 * const packageOrDts = /(?:package.json)|(?:\.d\.ts$)/i;
 * const files = await pack.getFiles(
 *   pack.fileListing.filter((path) => packageOrDts.test(path))
 * );
 * ```
 */

import { fetchFile, fetchFileListing } from './fs/package-fs';
import urlJoin from 'url-join';

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
  types?: string;
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
      throw new Error('packageJson not available.');
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
      throw new Error('fileListing not available.');
    }
    return this._fileListing;
  }

  /**
   * The absolute name and version of the package.
   *
   * i.e. `@<org>/<package>@<version>`
   *
   * This may differ from the `path` passed in during creation.
   * For example, if the package path was `mypackage@latest` and the latest
   * version is `1.2.3` as stated by the `package.json` the resulting
   * specifier will be `mypackage@1.2.3`.
   */
  public get specifier(): string {
    return `${this.packageJson.name}@${this.packageJson.version}`;
  }

  /**
   * The version of the package specified in the `package.json`
   */
  public get version(): string {
    return this.packageJson.version;
  }

  public get packageBase(): string {
    if (this._packageBase) {
      return this._packageBase;
    }

    this._packageBase = urlJoin('/node_modules', this.packageJson.name);
    return this.packageBase;
  }

  /**
   * Get the "types" property from `package.json`, and ensure it's path is
   * relative to `/`.
   */
  public get types(): string | null {
    if (!this.packageJson.types) return null;
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

  static async fetch(specifier: string): Promise<Pack> {
    const pack = new Pack({
      path: specifier,
      packageJson: JSON.parse(await fetchFile(specifier + '/package.json')),
      fileListing: Array.from(await fetchFileListing(specifier)),
    });

    return pack;
  }
}
