import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const gemmaDirectory = path.resolve("dist", "models", "gemma");

try {
  const entries = await readdir(gemmaDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".task"))
      .map((entry) => rm(path.join(gemmaDirectory, entry.name), { force: true })),
  );
  console.log("Gemma model excluded from production build");
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}
