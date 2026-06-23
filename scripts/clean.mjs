import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(".");
const generatedDirectories = ["dist", ".tmp-tests", "artifacts"];

for (const directory of generatedDirectories) {
  await removeWorkspacePath(directory);
}

for (const entry of await readdir(workspaceRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.toLowerCase().endsWith(".log")) {
    await removeWorkspacePath(entry.name);
  }
}

console.log("Generated files removed");

async function removeWorkspacePath(relativePath) {
  const target = path.resolve(workspaceRoot, relativePath);
  const relative = path.relative(workspaceRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside workspace: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}
