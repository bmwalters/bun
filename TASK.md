# Background
I'm working to port the codegen scripts used during bun's build process to nodejs + esbuild. Before this porting effort, the codegen scripts have a dependency on (a prior version of) the Bun CLI.

The commits on this branch so far have been sufficient to remove the dependency on `bun` in a few key use cases:
* As an interpreter (`bun` / `bun run`) --> modern versions of node can interpret TypeScript files by employing type stripping.
* As a bundler (`bun build`) --> replaced invocations with esbuild (already inconsistently used by certain codegen scripts). Requires finesse to ensure output formats match Bun as the codegen scripts are tightly coupled to the bundler output format.
* As a package manager (`bun install`) --> npm install.

So far, codegen ostensibly completes and a bun-debug binary can be built with the replacements listed above. However not all tests are passing.

# Task 1: Fix `assert` builtin

## Description

* The following command fails:

```
BUN_DEBUG_QUIET_LOGS=1 ./build/debug-local/bun-debug -e 'import assert from "assert"; assert.strictEqual(2, 2);'
```

## Acceptance criteria

* `./build/debug/bun-local-debug test ./test/regression/issue/css-system-color-mix-crash.test.ts` no longer encounters the error described above.

## Current status

* What we know so far
	* The error message comes from WebKit's JavaScriptCore (sources are in vendor/WebKit); the responsibility split is that bun communicates builtin(s) script code to JSC which then raises this error.
	* The project has a lengthy build process to assemble the builtins, orchestrated by src/codegen/bundle-modules.ts (via CMake). TS source --> preprocessing (bundle-modules; writes to tmp_modules/) --> the bundler (bun on main branch, esbuild on our branch; writes to tmp_modules/modules_out/) --> postprocessing (bundle-modules; writes to js/) --> JS source --> C++ bytearrays (e.g. codegen/WebCoreJSBuiltins.cpp; only used when not hot loading) --> final binary
	* The /format/ of the generated builtins is already correct; it matches what's expected by Bun + JSC. Each builtin is a function expression which returns exports (stored in `$` by convention).
* Debugging steps tried
	* Looked for env vars that could improve debug output from JSC (primarily in jsc.zig); nothing useful for this particular issue.
	* Ran under lldb to catch the SIGABRT; stack trace not immediately useful, but could be promising
	* Bisected the failing assert.js builtin to produce a minimal repro; the resulting file is much smaller (~350 bytes) but still appears fully syntactically valid and indeed successfully parses under jsc alone (when not provided as a builtin). (Note that bun-debug is configured to hot-load from build/debug-local/js for quick iteration).
* Paths forward
	* examine the source of the error in WebKit sources; enable additional debugging options and/or modify the code to log more debug info.
	* compare output from bundle-modules.ts on the main branch vs this development branch. the salient change is swapping Bun as the bundler for esbuild.
	* lldb (see above)
	* try swapping out WebKit for upstream (i.e. not the oven fork)
* Changes made so far
	* None

## Subtask N: ...

Description: ...
Current status: ...

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
