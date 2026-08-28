# Publishing to Fedora COPR

`noisitron.spec` repackages the project's own prebuilt `noisitron_<version>_amd64.deb`
release asset for RPM-based distros, the same "vendor blob" approach used for
Arch (`../aur/PKGBUILD`) and Ubuntu (`../ppa/debian/`) - there's no meaningful
from-source RPM build for a bundled Electron/Chromium app.

## Before the first publish

1. **Create a Fedora account** at https://accounts.fedoraproject.org/, if you
   don't have one - no Fedora installation needed, this is just an identity
   account.
2. **Log into COPR** at https://copr.fedorainfracloud.org/ with that account.
3. **Create a new project**: "New Project" → name it `noisitron` → this
   becomes `leafyalex/noisitron`, and its enable command is
   `dnf copr enable leafyalex/noisitron`.
4. Pick chroots (build targets) for the project - at minimum the current
   Fedora releases, x86_64 only (this Source0 .deb is amd64-only).

## Publishing a version (via the COPR web UI - no local tooling needed)

1. On the project page: **Builds → New Build → SCM**.
2. Point it at this GitHub repo (`https://github.com/ProbAlex/Noisitron`),
   branch `main` (or wherever you tag releases from), and set the **Spec
   File Path** to `packaging/copr/noisitron.spec`.
3. Build type: "rpkg" or "tito" isn't needed here - the plain spec-file SCM
   method is enough, since `Source0` is a plain URL COPR resolves itself
   when generating the SRPM (it doesn't need network access *during* the
   actual chroot build, only when turning the spec into an SRPM beforehand,
   which COPR's build service handles).
4. Submit the build. COPR emails you (and shows on the project's Builds
   page) whether it succeeded per chroot.

(There's also a CLI, `copr-cli`, if you'd rather script this than click
through the web UI - `pip install copr-cli`, then `copr-cli build
leafyalex/noisitron packaging/copr/noisitron.spec` after configuring
`~/.config/copr` with an API token from your COPR account settings page.)

## What users run afterward

```sh
sudo dnf copr enable leafyalex/noisitron
sudo dnf install noisitron
```

## Releasing a new version later

Bump `Version:` (and reset `Release:` to `1%{?dist}`) in `noisitron.spec`,
add a `%changelog` entry, commit, and submit a new build the same way -
COPR reads whatever's on the branch/path you configured, so pushing the
updated spec plus starting a new build is the whole flow.
