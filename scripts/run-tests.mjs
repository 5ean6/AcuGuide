import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const tmpDir = path.resolve(".tmp-tests");
const tscBin = path.resolve("node_modules", "typescript", "bin", "tsc");

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });
await writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ type: "commonjs" }));

try {
  await run(process.execPath, [tscBin, "-p", "tsconfig.test.json"]);
  await run(process.execPath, ["--test", "tests/domain.test.cjs"]);
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
