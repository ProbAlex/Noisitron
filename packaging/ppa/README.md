# Publishing to a Launchpad PPA (Ubuntu)

This directory holds a Debian *source* package definition for Noisitron.
Like `../aur/`, it's not built as part of the app itself - it repackages the
already-built `noisitron_<version>_amd64.deb` release asset rather than
compiling from source (see `debian/README.source`). A PPA only accepts
source uploads, which Launchpad's own build farm then compiles (or, here,
just repackages) per Ubuntu release series.

## Before the first publish

1. **Create a Launchpad account** at https://launchpad.net/, if you don't
   have one.
2. **Create and register a GPG key** - Launchpad requires every upload to be
   signed:
   ```sh
   gpg --full-generate-key          # RSA, 4096 bits, your name + the email on your Launchpad account
   gpg --armor --export YOUR_KEY_ID # paste this into Launchpad: Account → OpenPGP keys
   ```
   Launchpad emails you a confirmation link/code to finish registering it -
   follow that before uploading anything.
3. **Create the PPA itself** at https://launchpad.net/~/+activate-ppa (while
   logged in) - name it `noisitron`, so it becomes `ppa:leafyalex/noisitron`.
4. Install the tools this needs (`dpkg-dev`, `debhelper`, `dput`) on a real
   Ubuntu machine or container - this dev sandbox has none of them:
   ```sh
   sudo apt install dpkg-dev debhelper dput
   ```

## Publishing a version

```sh
./build-source-package.sh 0.3.0
cd build/noisitron-0.3.0
dpkg-buildpackage -S -sa -k<YOUR_GPG_KEY_ID>
cd ..
dput ppa:leafyalex/noisitron noisitron_0.3.0-1_source.changes
```

Launchpad emails you when the build finishes (or fails) - check
https://launchpad.net/~leafyalex/+archive/ubuntu/noisitron/+packages too.

A PPA build targets **one Ubuntu series at a time** - `debian/changelog`'s
`noble` targets 24.04 LTS. To also support another series (e.g. `jammy` for
22.04), bump the changelog to a new entry targeting that series (conventionally
with a `~<series>1` version suffix, e.g. `0.3.0-1~jammy1`) and upload again;
since this package has no real compiled dependencies, the same orig tarball
works unchanged across series.

## What users run afterward

```sh
sudo add-apt-repository ppa:leafyalex/noisitron
sudo apt update
sudo apt install noisitron
```

## Releasing a new version later

Bump the version in `debian/changelog` (`dch -v 0.4.0-1` handles the
boilerplate if you have `devscripts` installed), then repeat the "Publishing
a version" steps above with the new version number.
