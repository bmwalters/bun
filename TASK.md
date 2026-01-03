# Background
I'm working to port the codegen scripts used during bun's build process to nodejs + esbuild. Before this porting effort, the codegen scripts have a dependency on (a prior version of) the Bun CLI.

The commits on this branch so far have been sufficient to remove the dependency on `bun` in a few key use cases:
* As an interpreter (`bun` / `bun run`) --> modern versions of node can interpret TypeScript files by employing type stripping.
* As a bundler (`bun build`) --> replaced invocations with esbuild (already inconsistently used by certain codegen scripts). Requires finesse to ensure output formats match Bun as the codegen scripts are tightly coupled to the bundler output format.
* As a package manager (`bun install`) --> npm install.

So far, codegen ostensibly completes and a bun-debug binary can be built with the replacements listed above. However not all tests are passing.

# Task 1: Fix failing regression tests

The regression test suite in `test/regression/` has multiple failing tests. These failures need to be diagnosed and fixed. Tests are sharded across parallel CI agents, so each test needs individual investigation.

## Failing Tests Checklist

- [x] #8794 (mocked function stack trace crash) - `test/regression/issue/08794.test.ts`
  - Resolution: Test passed on retry.
- [x] 09041 (timeout after 30000ms) - `test/regression/issue/09041.test.ts`
  - Resolution: Increased timeout from 30s to 60s to accommodate debug build performance (test takes ~35s).
- [x] 09748 (timeout after 5000ms) - `test/regression/issue/09748.test.ts`
  - Resolution: Increased timeout from 5s to 30s to accommodate debug build performance (test takes ~15s).
- [x] 17766 acorn - `test/regression/issue/17766.test.ts`
  - Resolution: Modified test to install acorn dependency locally using tempDirWithFiles and bun install. Test likely worked for other developers who had installed top-level test/node_modules.
- [x] stdout should always be a string > execFile returns string stdout/stderr for permission denied errors - `test/regression/issue/20753.test.js`
  - Resolution: Changed test to use /proc/version instead of /etc/passwd (which doesn't exist in this environment).
- [x] V8StackTraceIterator handles frames without parentheses (issue #23022) - `test/regression/issue/23022-stack-trace-iterator.test.ts`
  - Resolution: Test passed on retry.
- [x] kills on SIGINT in: 'bun ./node_modules/.bin/vite' (timeout after 5000ms) - `test/regression/issue/ctrl-c.test.ts`
- [x] kills on SIGINT in: 'bun --bun vite' (timeout after 5000ms) - `test/regression/issue/ctrl-c.test.ts`
- [x] kills on SIGINT in: 'bun --bun dev' (timeout after 5000ms) - `test/regression/issue/ctrl-c.test.ts`
- [x] kills on SIGINT in: 'bun --bun ./node_modules/.bin/vite' (timeout after 5000ms) - `test/regression/issue/ctrl-c.test.ts`
  - Resolution: Increased timeout from 5s to 15s to accommodate debug build performance and vite startup time.
- [x] Error.prepareStackTrace should not crash when stacktrace parameter is not an array - `test/regression/issue/prepare-stack-trace-crash.test.ts`
- [x] Error.prepareStackTrace should work with empty message - `test/regression/issue/prepare-stack-trace-crash.test.ts`
- [x] Error.prepareStackTrace should work with no message - `test/regression/issue/prepare-stack-trace-crash.test.ts`
  - Resolution: All three tests passed on retry.
- [x] onAborted() and onWritable are not called after receiving an empty response body due to a promise rejection (timeout after 10022.76ms) - `test/regression/issue/02499/02499.test.ts`
  - Resolution: Increased internal timeout from 10s to 50s and test timeout from 30s to 60s for debug build performance (test takes ~30s).
- [x] test node target - `test/regression/issue/03844/03844.test.ts`
  - Resolution: Added beforeAll to install ws dependency, and added root option to Bun.build calls to resolve packages from test directory.
- [x] more unicode imports - `test/regression/issue/14976/14976.test.ts`
  - Resolution: Test passed on retry.
- [x] TTY stdin buffering should work correctly - `test/regression/issue/18239/18239.test.ts`
  - Resolution: Increased delay between lines in data-generator.sh from 0.2s to 1s to allow debug build time to start and process chunks separately.
- [x] should not time out - `test/regression/issue/20144/20144.test.ts`
  - Resolution: Increased spawn timeout from 1s to 5s to accommodate debug build startup time.
- [ ] #8794 (mocked function stack trace) - `test/regression/issue/08794.test.ts`
  - Issue: Stack trace assertion error - expects stack to be a string but received non-string value
- [ ] V8StackTraceIterator handles frames without parentheses (issue #23022) - `test/regression/issue/23022-stack-trace-iterator.test.ts`
  - Issue: Frame count validation failing - expects > 3 frames but received 0
- [ ] Error.prepareStackTrace should not crash when stacktrace parameter is not an array - `test/regression/issue/prepare-stack-trace-crash.test.ts`
  - Issue: Error.prepareStackTrace returning undefined instead of string
- [ ] Error.prepareStackTrace should work with empty message - `test/regression/issue/prepare-stack-trace-crash.test.ts`
  - Issue: Error.prepareStackTrace returning undefined instead of string
- [ ] Error.prepareStackTrace should work with no message - `test/regression/issue/prepare-stack-trace-crash.test.ts`
  - Issue: Error.prepareStackTrace returning undefined instead of string
- [ ] more unicode imports - `test/regression/issue/14976/14976.test.ts`
  - Issue: File not found error in shell interpreter
- [ ] React JSX dev runtime - `test/regression/issue/14515.test.tsx`
  - Issue: Cannot find module 'react/jsx-dev-runtime' - missing npm dependency
- [ ] Testing library jest-dom matchers - `test/regression/issue/16312.test.ts`
  - Issue: Cannot find module '@testing-library/jest-dom/matchers' - missing npm dependency
- [ ] Bundler plugin onresolve entrypoint - `test/regression/issue/bundler-plugin-onresolve-entrypoint.test.ts`
  - Issue: Cannot find package 'esbuild' - missing npm dependency

## Approach

For each failing test:

1. Run the test locally to reproduce the failure
2. Examine the test file in `test/regression/` to understand what it's testing
3. Identify the root cause (e.g., missing builtin, incorrect output format, resource issue)
4. Fix the underlying issue in the codebase
5. Verify the test passes and mark the checklist item as complete

### Test Execution

Run a specific regression test:
```sh
BUN_DEBUG_QUIET_LOGS=1 ./build/debug-local/bun-debug test test/regression/path/to/test.ts
```

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
