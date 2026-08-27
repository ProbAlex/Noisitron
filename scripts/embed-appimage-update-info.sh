#!/usr/bin/env bash
# electron-builder's AppImage target has no concept of the AppImageUpdate/GearLever
# update-info convention (a small ELF section, `.upd_info`, pointing update-checking
# tools at "gh-releases-zsync|owner|repo|latest|asset-glob"), and there's no config
# field to make it add one. This script post-processes the AppImage electron-builder
# already built, using the official `appimagetool` to re-embed it with that info and
# generate the accompanying .zsync sidecar - in place, same filename, so nothing
# downstream (the release workflow's asset upload) needs to know this happened.
set -euo pipefail

REPO_OWNER="ProbAlex"
REPO_NAME="Noisitron"
PRODUCT_NAME="Noisitron" # must match electron-builder.yml's productName - artifact filenames are "${productName}-${version}.AppImage"
DIST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/noisitron-appimagetool"
APPIMAGETOOL="$CACHE_DIR/appimagetool-x86_64.AppImage"
RUNTIME_FILE="$CACHE_DIR/runtime-x86_64"

APPIMAGE_PATH="$(find "$DIST_DIR" -maxdepth 1 -name '*.AppImage' -print -quit)"
if [ -z "$APPIMAGE_PATH" ]; then
  echo "No .AppImage found in $DIST_DIR - run the AppImage build first." >&2
  exit 1
fi

mkdir -p "$CACHE_DIR"
if [ ! -x "$APPIMAGETOOL" ]; then
  echo "Fetching appimagetool..."
  curl -sSL -o "$APPIMAGETOOL" \
    https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x "$APPIMAGETOOL"
fi
if [ ! -f "$RUNTIME_FILE" ]; then
  # Pre-fetched ourselves (rather than letting appimagetool's bundled libcurl fetch it)
  # since that download can hang in some sandboxed/restricted-network environments even
  # when a plain `curl` to the same host works fine.
  echo "Fetching AppImage type2 runtime..."
  curl -sSL -o "$RUNTIME_FILE" \
    https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Extracting $APPIMAGE_PATH..."
(cd "$WORKDIR" && env -u ELECTRON_RUN_AS_NODE "$APPIMAGE_PATH" --appimage-extract >/dev/null)

echo "Re-packaging with update information..."
rm -f "$APPIMAGE_PATH" "$APPIMAGE_PATH.zsync"
ARCH=x86_64 "$APPIMAGETOOL" \
  -u "gh-releases-zsync|$REPO_OWNER|$REPO_NAME|latest|$PRODUCT_NAME-*.AppImage.zsync" \
  --runtime-file "$RUNTIME_FILE" \
  "$WORKDIR/squashfs-root" "$APPIMAGE_PATH" < /dev/null

chmod +x "$APPIMAGE_PATH"
echo "Done: $APPIMAGE_PATH (+ $(basename "$APPIMAGE_PATH").zsync)"
