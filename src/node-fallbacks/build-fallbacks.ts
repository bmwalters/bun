import * as fs from "fs";
import * as Module from "module";
import { basename, extname } from "path";
import * as esbuild from "esbuild";

const allFiles = fs.readdirSync(".").filter(f => f.endsWith(".js"));
const outdir = process.argv[2];
const builtins = Module.builtinModules;
let commands: Promise<void>[] = [];

let moduleFiles: string[] = [];
for (const name of allFiles) {
  const mod = basename(name, extname(name)).replaceAll(".", "/");
  const file = allFiles.find(f => f.startsWith(mod));
  moduleFiles.push(file as string);
}

for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
  const name = allFiles[fileIndex];
  const mod = basename(name, extname(name)).replaceAll(".", "/");
  const file = allFiles.find(f => f.startsWith(mod));
  const externals = [...builtins];
  const i = externals.indexOf(name);
  if (i !== -1) {
    externals.splice(i, 1);
  }

  // Build all files at once with specific options
  const externalModules = builtins
    .concat(moduleFiles.filter(f => f !== name))
    .flatMap(b => [`node:${b}`, `${b}`]);

  const isStream = name.includes("stream");

  commands.push(
    (async () => {
      await esbuild.build({
        entryPoints: [name],
        outdir: outdir,
        bundle: true,
        define: {
          "process.env.NODE_DEBUG": '"false"',
          "process.env.READABLE_STREAM": "'enable'",
          "global": "globalThis",
        },
        minifySyntax: true,
        minifyWhitespace: true,
        format: isStream ? "cjs" : "esm",
        platform: "node",
        external: externalModules,
      });

      // This is very brittle. But that should be okay for our usecase
      let outfile = fs.readFileSync(`${outdir}/${name}`, "utf8")
        .replaceAll("__require(", "require(")
        .replaceAll("import.meta.url", "''")
        .replaceAll("createRequire", "")
        .replaceAll("global.process", "require('process')")
        .trim();

      while (outfile.startsWith("import{")) {
        outfile = outfile.slice(outfile.indexOf(";") + 1);
      }

      if (outfile.includes('"node:module"')) {
        console.log(outfile);
        throw new Error("Unexpected import in " + name);
      }

      if (outfile.includes("import.meta")) {
        throw new Error("Unexpected import.meta in " + name);
      }

      if (outfile.includes(".$apply")) {
        throw new Error("$apply is not supported in browsers (while building " + name + ")");
      }

      if (outfile.includes(".$call")) {
        throw new Error("$call is not supported in browsers (while building " + name + ")");
      }

      if (
        outfile.includes("$isObject(") ||
        outfile.includes("$isPromise(") ||
        outfile.includes("$isUndefinedOrNull(")
      ) {
        throw new Error("Unsupported function in " + name);
      }

      fs.writeFileSync(`${outdir}/${name}`, outfile);
    })(),
  );
}

await Promise.all(commands);
