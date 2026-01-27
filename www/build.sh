#!/usr/bin/env bash
# Minifies www assets using esbuild (from sdk/node_modules)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ESBUILD="$DIR/../sdk/node_modules/.bin/esbuild"

if [ ! -f "$ESBUILD" ]; then
  echo "esbuild not found. Run: cd ../sdk && bun install"
  exit 1
fi

"$ESBUILD" "$DIR/styles.css" --minify --outfile="$DIR/styles.min.css"
"$ESBUILD" "$DIR/app.js" --minify --outfile="$DIR/app.min.js"

echo "Done. Minified assets written to www/"
