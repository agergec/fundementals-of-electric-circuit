#!/usr/bin/env bash
# CircuitLab — developer helper script
#
# Usage: ./dev.sh <command>
#
# Commands:
#   dev       Start the development server with hot reload (default)
#             Opens at http://localhost:5173
#             Changes to source files are reflected instantly in the browser.
#
#   build     Compile TypeScript and build optimised production files into dist/
#             Run this before deploying to GitHub Pages or any static host.
#
#   preview   Serve the production build (dist/) locally at http://localhost:4173
#             Use after `build` to verify the production output before deploying.
#
#   lint      Run ESLint across all source files
#             Checks for code quality issues and enforces style rules.
#
# Examples:
#   ./dev.sh          # start dev server (default)
#   ./dev.sh build    # production build
#   ./dev.sh preview  # preview the build

set -e
cd "$(dirname "$0")"

CMD="${1:-}"

case "$CMD" in
  dev)
    echo "► Starting dev server at http://localhost:5173 ..."
    npm run dev
    ;;
  build)
    echo "► Compiling TypeScript and building production files into dist/ ..."
    npm run build
    echo "✓ Build complete. Run './dev.sh preview' to test it locally."
    ;;
  preview)
    echo "► Serving production build at http://localhost:4173 ..."
    echo "  (Run './dev.sh build' first if dist/ is out of date)"
    npm run preview
    ;;
  lint)
    echo "► Running ESLint ..."
    npm run lint
    ;;
  ""|*)
    if [ -n "$CMD" ]; then
      echo "Unknown command: $CMD"
      echo ""
    fi
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  dev       Start the development server with hot reload"
    echo "            Opens at http://localhost:5173"
    echo "            Changes to source files are reflected instantly in the browser."
    echo ""
    echo "  build     Compile TypeScript and build optimised production files into dist/"
    echo "            Run this before deploying to GitHub Pages or any static host."
    echo ""
    echo "  preview   Serve the production build (dist/) at http://localhost:4173"
    echo "            Use after 'build' to verify the output before deploying."
    echo ""
    echo "  lint      Run ESLint across all source files"
    echo "            Checks for code quality issues and enforces style rules."
    [ -n "$CMD" ] && exit 1 || exit 0
    ;;
esac
