#!/usr/bin/env bash
# Builds a Debian source package (.dsc + orig tarball + .changes) ready for
# `dput` to a Launchpad PPA, from an already-published GitHub release's .deb.
#
# Run this on a real Ubuntu machine (or an Ubuntu container/VM) with
# `dpkg-dev` and `debhelper` installed - this dev sandbox has neither, the
# same reason the AUR packaging docs point at "an Arch machine" for makepkg.
#   sudo apt install dpkg-dev debhelper
set -euo pipefail

VERSION="${1:?Usage: build-source-package.sh <version>   e.g. build-source-package.sh 0.3.0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$HERE/build"
SRC_DIR="$BUILD_DIR/noisitron-$VERSION"

rm -rf "$SRC_DIR"
mkdir -p "$SRC_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Downloading noisitron_${VERSION}_amd64.deb from the GitHub release..."
curl -sSL -o "$WORK/noisitron_${VERSION}_amd64.deb" \
  "https://github.com/ProbAlex/Noisitron/releases/download/v${VERSION}/noisitron_${VERSION}_amd64.deb"

echo "Extracting its payload..."
(cd "$WORK" && ar x "noisitron_${VERSION}_amd64.deb" && tar xf data.tar.* -C "$SRC_DIR")

echo "Building the orig tarball..."
tar czf "$BUILD_DIR/noisitron_${VERSION}.orig.tar.gz" -C "$BUILD_DIR" "noisitron-$VERSION"

echo "Copying in debian/ packaging..."
cp -r "$HERE/debian" "$SRC_DIR/debian"

cat <<EOF

Source tree ready: $SRC_DIR

Next steps:
  cd "$SRC_DIR"
  dpkg-buildpackage -S -sa -us -uc     # unsigned - dput/Launchpad will ask you to sign, or add -k<KEYID> here
  cd ..
  debsign noisitron_${VERSION}-1_source.changes   # if not already signed above
  dput ppa:leafyalex/noisitron noisitron_${VERSION}-1_source.changes
EOF
