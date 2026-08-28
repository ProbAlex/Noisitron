<div align="center">

# Noisitron

**A Linux soundboard that mixes audio clips into a virtual microphone for Discord — while you monitor playback through your headphones.**

[![Latest release](https://img.shields.io/github/v/release/ProbAlex/Noisitron?label=release&color=blueviolet)](https://github.com/ProbAlex/Noisitron/releases/latest)
[![Release build](https://img.shields.io/github/actions/workflow/status/ProbAlex/Noisitron/release.yml?label=build)](https://github.com/ProbAlex/Noisitron/actions/workflows/release.yml)
[![License: GPL-3.0](https://img.shields.io/github/license/ProbAlex/Noisitron?color=blue)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/ProbAlex/Noisitron/total?color=success)](https://github.com/ProbAlex/Noisitron/releases)
[![Fedora COPR](https://copr.fedorainfracloud.org/coprs/leafyalex2/noisitron/package/noisitron/status_image/last_build.png)](https://copr.fedorainfracloud.org/coprs/leafyalex2/noisitron/)

[Install](#installation) · [Features](#features) · [Building from source](#building-from-source) · [Contributing](#contributing)

</div>

---

## What it does

Noisitron creates a virtual PulseAudio/PipeWire microphone. Anything you trigger from the soundboard gets mixed into that virtual mic — so Discord (or any other app) hears your sound clips right alongside your voice — while a separate monitor path lets you hear playback through your own headphones without it looping back into the mic.

## Features

- Virtual mic routing over PulseAudio/PipeWire, with independent mic/headphone volume control
- Nested folders — organize sounds into folders inside folders, browsed like a file manager
- Global keybinds, plus CLI/Stream Deck triggering (`noisitron --play <sound>`)
- Per-sound volume, custom emoji or image icon, and a built-in waveform trim editor
- Built-in sound store — search and download clips from MyInstants directly into your library
- Runs in the background — closing the window (or the CLI/keybind path) just minimizes to tray, so triggers keep working without the GUI open
- Folder sync — re-importing picks up new files added to a source folder since last time, automatically

## Installation

| Distro / format | Status |
|---|---|
| [AppImage](#appimage-any-distro) (any distro) | ✅ Available |
| [Ubuntu / Debian](#ubuntu--debian) | ✅ Available (PPA + `.deb`) |
| [Fedora](#fedora) | ✅ Available (COPR + `.rpm`) |
| [openSUSE](#opensuse) | ✅ Available (OBS repo + `.rpm`) |
| Arch Linux (AUR) | 🚧 Coming soon |
| Flatpak | 🚧 Coming soon |

### AppImage (any distro)

Download the latest `.AppImage` from the [releases page](https://github.com/ProbAlex/Noisitron/releases/latest), make it executable, and run it:

```sh
chmod +x Noisitron-*.AppImage
./Noisitron-*.AppImage
```

**Recommended: manage it with [GearLever](https://github.com/mijorus/gearlever).** Noisitron's AppImage ships with update metadata baked in (the same `gh-releases-zsync` convention AppImageUpdate and GearLever both understand), so GearLever can integrate it into your app menu, keep it updated, and check for new versions automatically — no separate updater bundled into the app itself. Point GearLever at the downloaded `.AppImage` and it takes care of the rest.

### Ubuntu / Debian

**Via PPA** (recommended — installs through `apt` and updates alongside your other packages):

```sh
sudo add-apt-repository ppa:leafyalex/ppa-noisitron
sudo apt update
sudo apt install noisitron
```

**Or download the `.deb` directly** from the [releases page](https://github.com/ProbAlex/Noisitron/releases/latest):

```sh
sudo apt install ./noisitron_*_amd64.deb
```

### Fedora

**Via COPR** (recommended):

```sh
sudo dnf copr enable leafyalex2/noisitron
sudo dnf install noisitron
```

**Or download the `.rpm` directly** from the [releases page](https://github.com/ProbAlex/Noisitron/releases/latest):

```sh
sudo dnf install ./noisitron-*.x86_64.rpm
```

### openSUSE

**Via the OBS repository** (recommended):

```sh
sudo zypper addrepo https://download.opensuse.org/repositories/home:leafyalex/openSUSE_Tumbleweed/home:leafyalex.repo
sudo zypper refresh
sudo zypper install noisitron
```

**Or download the `.rpm` directly** from the [releases page](https://github.com/ProbAlex/Noisitron/releases/latest):

```sh
sudo zypper install ./noisitron-*.x86_64.rpm
```

### Arch Linux — coming soon

An AUR package (`noisitron-bin`) is planned but not published yet.

### Flatpak — coming soon

A Flathub submission is planned but not live yet. Until then, the [AppImage](#appimage-any-distro) (ideally managed through GearLever) is the closest equivalent — a single portable build that isn't tied to your distro's package manager.

## Building from source

Requires Node.js 20+.

```sh
git clone https://github.com/ProbAlex/Noisitron.git
cd Noisitron
npm install
npm run dev          # run in development mode
npm run typecheck    # type-check the whole project
npm run dist:linux   # build local AppImage/.deb/.rpm into dist/
```

The app is Electron + React + TypeScript (`electron-vite` for the build pipeline, Zustand for renderer state). Main-process code lives in `src/main`, the renderer in `src/renderer`, and IPC contracts shared between them in `src/shared`.

## Contributing

Contributions are welcome — bug reports, feature suggestions, and pull requests alike.

- **Branching:** work lands on `dev` first; `main` is what triggers releases (see below), so please open PRs against `dev` rather than `main`.
- **Before submitting a PR:** run `npm run typecheck` and make sure `npm run dev` still launches cleanly.
- **Scope:** try to keep PRs focused — a bug fix doesn't need to bring an unrelated refactor along with it.
- **Issues:** if you're planning a larger change, opening an issue first to discuss the approach is appreciated but not required.

### How releases work

Every push to `main` is checked against `package.json`'s version. If that version isn't already tagged, CI cuts a real release automatically: it builds and publishes the AppImage/`.deb`/`.rpm` to GitHub Releases, pushes the update to the PPA, and (via webhooks) triggers rebuilds on COPR and OBS. Routine pushes that don't change the version are a no-op. In practice, releasing is just: bump the version, merge to `main`.

The `packaging/` directory holds the distro-specific packaging definitions this depends on:

- `packaging/aur/` — Arch/AUR `PKGBUILD`
- `packaging/ppa/` — Debian source package for the Launchpad PPA
- `packaging/copr/` — RPM spec for Fedora COPR
- `packaging/obs/` — RPM spec for the openSUSE Build Service

All four repackage the same prebuilt Linux release rather than compiling from source — there's no meaningful from-source build for a bundled Electron/Chromium app on any of these build farms.

## License

[GPL-3.0-only](LICENSE)
