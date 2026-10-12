import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }

  return moduleUrl === pathToFileURL(realpathSync(entry)).href;
}

export function runMain(moduleUrl: string, main: () => Promise<void>): void {
  if (!isMainModule(moduleUrl)) {
    return;
  }

  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
