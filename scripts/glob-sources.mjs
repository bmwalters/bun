import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { normalize } from "node:path/posix";

const root = resolve(import.meta.dirname, "..");
let total = 0;

async function globSources(output, patterns, excludes = []) {
  const paths = [];
  for (const pattern of patterns) {
    for await (const path of glob(pattern)) {
      if (excludes?.some(exclude => normalize(path) === normalize(exclude))) {
        continue;
      }
      paths.push(path);
    }
  }
  total += paths.length;

  const sources =
    paths
      .map(path => normalize(relative(root, path).replaceAll("\\", "/")))
      .sort((a, b) => a.localeCompare(b))
      .join("\n")
      .trim() + "\n";

  const outputPath = join(root, "cmake", "sources", output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sources);
}

const inputContent = await readFile(join(root, "cmake", "Sources.json"), "utf8");
const input = JSON.parse(inputContent);

const start = performance.now();
for (const item of input) {
  await globSources(item.output, item.paths, [
    ...(item.exclude || []),
    "src/bun.js/bindings/GeneratedBindings.zig",
    "src/bun.js/bindings/GeneratedJS2Native.zig",
  ]);
}

const end = performance.now();

const green = "\x1b[32m";
const reset = "\x1b[0m";
const bold = "\x1b[1m";
console.log(`\nGlobbed ${bold}${green}${total}${reset} sources [${(end - start).toFixed(2)}ms]`);
