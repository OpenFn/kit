/**
 * Package FS
 *
 * Utilities for loading packages
 */
import fetch from "cross-fetch";
import { LocalStorage } from "node-localstorage";
global.localStorage = new LocalStorage("./tmp");

export class NotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFound";
  }
}

interface PackageListing {
  path: string;
  type: "directory" | "file";
  files?: PackageListing[];
}

function* flattenFiles(
  listing: PackageListing,
  path: string = ""
): Generator<string> {
  if (listing.type == "directory") {
    for (let i = 0; i < listing.files!.length; i++) {
      const f = listing.files![i];
      yield* flattenFiles(f);
    }
  } else {
    yield `${path}${listing.path}`;
  }
}

export async function fetchFileListing(packageName: string) {
  const cached = localStorage.getItem(packageName);
  if (cached) {
    return flattenFiles(JSON.parse(cached));
  }

  const response = await fetch(`https://unpkg.com/${packageName}/?meta`);

  if (response.status != 200) {
    throw new Error(
      `Failed getting file listing for: ${packageName} got: ${response.status} ${response.statusText}`
    );
  }

  const listing = (await response.json()) as PackageListing;
  localStorage.setItem(packageName, JSON.stringify(listing));

  return flattenFiles(listing);
}

const dtsExtension = /\.d\.ts$/;

/**
 * Retrieves a list of .d.ts files for a given package from unpkg.com.
 * @example
 * for await (const f of fetchDTS("@typescript/vfs")) {
 *   console.log(f);
 * }
 * @param packageName string
 */
export async function* fetchDTSListing(packageName: string) {
  for (const f of await fetchFileListing(packageName)) {
    if (dtsExtension.test(f)) {
      yield f;
    }
  }
}

/**
 * Retrieves a files for a given package/path from unpkg.com.
 * @param path string
 */
export async function fetchFile(path: string) {
  const cached = localStorage.getItem(path);
  if (cached) {
    return cached;
  }

  const response = await fetch(`https://unpkg.com/${path}`);

  switch (response.status) {
    case 200:
      const contents = await response.text();
      localStorage.setItem(path, contents);

      return contents;
    case 404:
      throw new NotFound(`Got 404 from Unpkg for: ${path}`);

    default:
      throw new Error(
        `Failed getting file at: ${path} got: ${response.status} ${response.statusText}`
      );
  }
}
