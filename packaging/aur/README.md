# Publishing `noisitron-bin` to the AUR

This directory holds the AUR package definition. It is **not** part of the
app itself and is not built by `npm run dist:linux` - the AUR git repo is a
separate repository that only ever contains `PKGBUILD` (and the generated
`.SRCINFO`), which is why this lives off to the side.

`PKGBUILD` downloads the `.deb` built by [`.github/workflows/release.yml`](../../.github/workflows/release.yml)
from a GitHub Release and re-packages its files for Arch - it does not
compile anything, so it needs no build dependencies beyond `ar` and `tar`
(both part of `base-devel`).

## Before the first publish

1. Push a version tag (e.g. `git tag v0.1.0 && git push --tags`) so the
   Release workflow builds and uploads `noisitron_<version>_amd64.deb` to a
   matching GitHub Release. `PKGBUILD`'s `source=` URL expects that exact
   asset name/path.
2. Replace `sha256sums=('SKIP')` in `PKGBUILD` with the real hash of that
   release asset - on any machine (Arch not required):
   ```sh
   curl -sL -o noisitron_0.1.0_amd64.deb \
     https://github.com/ProbAlex/Noisitron/releases/download/v0.1.0/noisitron_0.1.0_amd64.deb
   sha256sum noisitron_0.1.0_amd64.deb
   ```
   `SKIP` disables integrity checking entirely, which AUR maintainers/users
   are right to be wary of for anything meant to stick around.
3. On an Arch machine, regenerate `.SRCINFO` from `PKGBUILD` rather than
   hand-editing it further (the copy here was hand-written to match, since
   this dev environment isn't Arch and doesn't have `makepkg`):
   ```sh
   makepkg --printsrcinfo > .SRCINFO
   ```
4. Sanity-check the package actually installs and runs:
   ```sh
   makepkg -si
   ```

## Publishing (requires your own AUR account - this step is yours to run)

1. Create an AUR account and add an SSH public key to it at
   https://aur.archlinux.org/, if you haven't already.
2. Clone the (empty, AUR-provisioned) package repo and copy these two files
   into it:
   ```sh
   git clone ssh://aur@aur.archlinux.org/noisitron-bin.git
   cp PKGBUILD .SRCINFO noisitron-bin/
   cd noisitron-bin
   git add PKGBUILD .SRCINFO
   git commit -m "Initial import: noisitron-bin 0.1.0"
   git push
   ```

## Releasing a new version later

Bump `pkgver`/`pkgrel` in `PKGBUILD`, update `sha256sums`, regenerate
`.SRCINFO`, commit and push to the AUR repo the same way - the same flow
`updpkgsums` + `makepkg --printsrcinfo` automates on an Arch machine.
