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

1. ~~Push a version tag so the Release workflow builds and uploads
   `noisitron_<version>_amd64.deb`~~ - done: `PKGBUILD` currently targets
   `v0.3.0`, and `sha256sums` already has that release asset's real hash
   (computed the same way as below). This step only matters again for a
   future version bump.
2. Replace `sha256sums` in `PKGBUILD` with the real hash of the release
   asset - on any machine (Arch not required):
   ```sh
   curl -sL -o noisitron_0.3.0_amd64.deb \
     https://github.com/ProbAlex/Noisitron/releases/download/v0.3.0/noisitron_0.3.0_amd64.deb
   sha256sum noisitron_0.3.0_amd64.deb
   ```
   (`SKIP` disables integrity checking entirely, which AUR maintainers/users
   are right to be wary of for anything meant to stick around - don't leave
   it in place.)
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

You said you don't have an AUR account yet, so start here:

1. **Create the account**: https://aur.archlinux.org/register/ - just an
   email + username, no Arch installation needed.
2. **Generate an SSH key** for it, if you don't already have one you want to
   use for this:
   ```sh
   ssh-keygen -t ed25519 -C "aur-noisitron" -f ~/.ssh/aur_noisitron
   ```
3. **Add the public key** to your AUR account: log in at
   https://aur.archlinux.org/, go to My Account, paste the contents of
   `~/.ssh/aur_noisitron.pub` into the SSH Public Key field, and save.
4. Make sure SSH actually uses that key for the AUR host (add to
   `~/.ssh/config` if it's not your default key):
   ```
   Host aur.archlinux.org
     IdentityFile ~/.ssh/aur_noisitron
     User aur
   ```
5. Clone the (empty, AUR-provisioned) package repo - this creates it on
   first push, no separate "create repo" step needed - and copy these two
   files into it:
   ```sh
   git clone ssh://aur@aur.archlinux.org/noisitron-bin.git
   cp PKGBUILD .SRCINFO noisitron-bin/
   cd noisitron-bin
   git add PKGBUILD .SRCINFO
   git commit -m "Initial import: noisitron-bin 0.3.0"
   git push
   ```
6. Check it landed: https://aur.archlinux.org/packages/noisitron-bin

## Releasing a new version later

Bump `pkgver`/`pkgrel` in `PKGBUILD`, update `sha256sums`, regenerate
`.SRCINFO`, commit and push to the AUR repo the same way - the same flow
`updpkgsums` + `makepkg --printsrcinfo` automates on an Arch machine.
