import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("src");
const extensions = new Set([".ts", ".tsx", ".css"]);
const failures = [];

const checks = [
  {
    pattern: /(^|[^A-Za-z])(?:as\s+any|:\s*any\b)/,
    message: "Avoid explicit any in source files",
  },
  {
    pattern: /console\.(log|warn|error|debug)/,
    message: "Avoid console statements in browser source",
  },
  {
    pattern: /(醫療級|臨床級|保證治療|保證有效|治癒)/,
    message: "Avoid overclaiming medical or treatment copy",
  },
  {
    pattern: /letter-spacing:\s*-/,
    message: "Avoid negative letter spacing",
  },
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const file of await walk(sourceRoot)) {
  const text = await readFile(file, "utf8");
  for (const check of checks) {
    if (check.pattern.test(text)) {
      failures.push(`${path.relative(process.cwd(), file)}: ${check.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Lint checks passed");
}
