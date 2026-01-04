# Background
I'm working to port the codegen scripts used during bun's build process to nodejs + esbuild. Before this porting effort, the codegen scripts have a dependency on (a prior version of) the Bun CLI.

The commits on this branch so far have been sufficient to remove the dependency on `bun` in a few key use cases:
* As an interpreter (`bun` / `bun run`) --> modern versions of node can interpret TypeScript files by employing type stripping.
* As a bundler (`bun build`) --> replaced invocations with esbuild (already inconsistently used by certain codegen scripts). Requires finesse to ensure output formats match Bun as the codegen scripts are tightly coupled to the bundler output format.
* As a package manager (`bun install`) --> npm install.

So far, codegen ostensibly completes and a bun-debug binary can be built while passing non-flaky portions of the regression test suite. However the patches must now be worked into a form suitable for contributing our patches to the upstream Bun project.

## Task 1: Define an upstreamable strategy for codegen dep installation

When bun is present, devDependencies from the top-level package.json will ensure dependencies such as esbuild and @lezer/cpp are visible to files in src/codegen/.

With npm, we are precluded from leveraging the top-level package.json as it relies on bun-specific features (namely, the workspace protocol in devDependencies).

There are a few solution options:

-3. Add support for workspace protocol to npm via plugin / local js file.
-2. Add support for workspace protocol to upstream npm.
-1. Use a non-bun tool which supports the workspace protocol (pnpm?).
0. Improve package.json's compatibility with node/npm.
1. Install from package.json, filtering out incompatible features. (jq '...' < package.json | npm install -)
	- Invoke this from CMake when npm is used.
	- Cons: could become out of date if more incompatible features are added.
2. Install from package.json, selecting only compatible features. (rg 'esbuild|@lezer' package.json | npm install -)
	- Invoke this from CMake when npm is used.
	- Cons: could become out of date if more compatible features / deps are added.
3. Define a standalone package.json within src/codegen/ and remove those dependencies from the top-level package.json.
	- May not be achievable if both src/codegen/ and other modules within src/ depend on these deps. Requires research.
	- Cons: complicates the installation process by adding one more installation command. mitigated somewhat by the fact that cmake already has to orchestrate some package installations, so not actually visible to project developers.
4. Define a standalone package.json within src/codegen/ but keep the top-level package.json too.
	- Same cons as (3), plus:
	- Cons: two sources of truth for which dependencies must be installed, version specifier, etc.
5. Extract src/codegen to a package in packages/ which is thus decoupled from the rest of src / the top-level package.json.
	- May not be achievable if codegen depends on modules within the rest of src. Still could be possible if dependency injection OR further extracting those deps to yet another top level package could be employed. Requires research.
6. Leave the question of how node_modules are populated for codegen out of scope for the bun repository; the distro package script would be responsible for making those dependencies visible when codegen scripts require them. (Write to node_modules or provide alternative path via env var if needed.)
	- In practice, could be implemented using (1) or (2) or by writing/copying directly to node_modules. Or install these globally on the system (a la Debian presumably). The distinction from (1) or (2) is that in those options CMake would encasulate those commands (if it detects an empty node_modules at the time of running codegen.)
7. Split to two distinct package.json files: package.json, package.npm.json; CMake selects as appropriate
	- Cons: Some duplication, thought it's quite discoverable for maintainers.
8. Keep package.json for everything except what's needed for codegen; move codegen to a standalone dependency fetching system (i.e. a package.codegen.json or even CMake's ExternalProject_Add)
	- Fundamentally seems like a variant of (3) or (4).

# Useful Commands

* Build bun (via cmake) using nodejs port:

```sh
node ./scripts/build.mjs \
	-GNinja \
	-DCMAKE_BUILD_TYPE=Debug \
	-DWEBKIT_LOCAL=ON \
	-B build/debug-local \
	--log-level=NOTICE \
	-DBUN_EXECUTABLE="$(which node)" \
	-DNPM_EXECUTABLE="$(which npm)" \
	-DZIG_EXECUTABLE="$(which zig)" \
	-DENABLE_ASAN=OFF
```

*Important:* First install LLVM version 19.

* Rebuild WebKit (JavaScriptCore)

```
cmake --build vendor/WebKit/WebKitBuild/Debug --target jsc && rm vendor/WebKit/WebKitBuild/Debug/JavaScriptCore/DerivedSources/inspector/InspectorProtocolObjects.h
```

* Run the resulting CLI:

```sh
BUN_DEBUG_QUIET_LOGS=1 ./build/debug-local/bun-debug -e 'console.log("hello world")'
```
