/**
 * Package FS
 *
 * Utilities for loading packages
 */
import fetch from "cross-fetch";

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

async function getFileListing(packageName: string) {
  const response = await fetch(`https://unpkg.com/${packageName}/?meta`);

  if (response.status != 200) {
    throw new Error(
      `Failed getting file listing for: ${packageName} got: ${response.status} ${response.statusText}`
    );
  }

  const listing = (await response.json()) as PackageListing;

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
export async function* fetchDTS(packageName: string) {
  for (const f of await getFileListing(packageName)) {
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
  const response = await fetch(`https://unpkg.com/${path}`);

  if (response.status != 200) {
    throw new Error(
      `Failed getting file at: ${path} got: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}
