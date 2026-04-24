#!/usr/bin/env bash
# CircuitLab — developer helper script
#
# Usage: ./dev_helper.sh <command>
#
# Commands:
#   install   Install dependencies from package.json into node_modules/
#             Run this once after cloning or when package.json changes.
#
#   dev       Start the development server with hot reload
#             Opens at http://localhost:5173
#             Changes to source files are reflected instantly in the browser.
#
#   build     Compile TypeScript and build optimised production files into dist/
#             Run this before deploying to GitHub Pages or any static host.
#
#   preview   Serve the production build (dist/) locally at http://localhost:4173
#             Use after 'build' to verify the production output before deploying.
#
#   lint      Run ESLint across all source files
#             Checks for code quality issues and enforces style rules.
#
# Examples:
#   ./dev_helper.sh install   # install node_modules (first time setup)
#   ./dev_helper.sh dev       # start dev server
#   ./dev_helper.sh build     # production build
#   ./dev_helper.sh preview   # preview the build

set -e
cd "$(dirname "$0")"

CMD="${1:-}"

case "$CMD" in
  install)
    echo "► Installing dependencies from package.json ..."
    npm install
    echo "✓ Done. Run './dev_helper.sh dev' to start the development server."
    ;;
  dev)
    if [ ! -d node_modules ]; then
      echo "⚠ node_modules not found. Running install first ..."
      npm install
    fi
    echo "► Starting dev server at http://localhost:5173 ..."
    npm run dev
    ;;
  build)
    if [ ! -d node_modules ]; then
      echo "⚠ node_modules not found. Running install first ..."
      npm install
    fi
    echo "► Compiling TypeScript and building production files into dist/ ..."
    npm run build
    echo "✓ Build complete. Run './dev_helper.sh preview' to test it locally."
    ;;
  preview)
    if [ ! -d dist ]; then
      echo "⚠ dist/ not found. Running build first ..."
      npm run build
    fi
    echo "► Serving production build at http://localhost:4173 ..."
    npm run preview
    ;;
  lint)
    if [ ! -d node_modules ]; then
      echo "⚠ node_modules not found. Running install first ..."
      npm install
    fi
    echo "► Running ESLint ..."
    npm run lint
    ;;
  ""|*)
    if [ -n "$CMD" ]; then
      echo "Unknown command: $CMD"
      echo ""
    fi
    echo "Usage: ./dev_helper.sh <command>"
    echo ""
    echo "Commands:"
    echo "  install   Install dependencies from package.json into node_modules/"
    echo "            Run this once after cloning or when package.json changes."
    echo ""
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
