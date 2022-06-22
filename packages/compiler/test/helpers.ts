import { readFile } from "node:fs/promises";

export function getDtsFixture(adaptorName: string): Promise<string> {
  return readFile(`test/fixtures/${adaptorName}.d.ts`, "utf-8");
}
