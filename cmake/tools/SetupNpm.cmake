# NPM_EXECUTABLE is used for `npm install` (or `bun install`) commands.
# By default, it uses BUN_EXECUTABLE, but may be overridden during bootstrapping.
# To use npm instead of bun, pass -DNPM_EXECUTABLE=/path/to/npm to CMake.
if(NOT DEFINED NPM_EXECUTABLE)
  set(NPM_EXECUTABLE ${BUN_EXECUTABLE})
endif()
set(NPM_EXECUTABLE ${NPM_EXECUTABLE} CACHE FILEPATH "NPM executable (bun or npm)" FORCE)
