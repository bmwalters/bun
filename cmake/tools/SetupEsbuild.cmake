if(CMAKE_HOST_WIN32)
  setx(ESBUILD_EXECUTABLE ${CWD}/node_modules/.bin/esbuild.exe)
else()
  setx(ESBUILD_EXECUTABLE ${CWD}/node_modules/.bin/esbuild)
endif()

register_bun_install(
  CWD
    ${CWD}
  NODE_MODULES_VARIABLE
    ESBUILD_NODE_MODULES
  OUTPUTS
    ${ESBUILD_EXECUTABLE}
)

if(CMAKE_COLOR_DIAGNOSTICS)
  set(ESBUILD_ARGS --color)
endif()
