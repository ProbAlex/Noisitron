Name:           noisitron
Version:        0.3.0
Release:        1
Summary:        Soundboard that mixes clips into a virtual mic for Discord

License:        GPL-3.0-only
URL:            https://github.com/ProbAlex/Noisitron
# A bare filename, not a URL: unlike COPR (whose rpkg build step fetches Source0 URLs
# itself), OBS never fetches Source0 - the _service file's download_url service must stage
# it locally before rpmbuild runs. Using a version-independent name here (matching download_url's
# `filename` param, fetched via GitHub's version-independent /releases/latest/download/ alias)
# means neither this line nor the _service file need ever change again on future releases.
Source0:        noisitron_amd64.deb

ExclusiveArch:  x86_64
BuildRequires:  binutils
BuildRequires:  tar

# openSUSE's package names for these differ from Fedora's in a few spots
# (mozilla-nss vs nss, libXss1 vs libXScrnSaver, libappindicator3-1 vs
# libappindicator-gtk3) - verified against real openSUSE packages, but this
# hasn't been build/install-tested on an actual openSUSE box yet.
Requires:       gtk3, mozilla-nss, libXss1, libXtst6, libnotify4, at-spi2-core, libsecret-1-0, xdg-utils, libpulse0
Recommends:     libappindicator3-1

# This repackages the project's own prebuilt Linux release (an Electron app)
# rather than compiling from source - there's no meaningful from-source RPM
# build for a bundled Chromium runtime. Same approach as ../aur/PKGBUILD,
# ../ppa/debian/README.source, and ../copr/noisitron.spec.
AutoReqProv:    no
%global __os_install_post %{nil}
%global debug_package %{nil}

%description
Noisitron mixes local audio clips into a virtual PulseAudio/PipeWire
microphone so Discord (or any other app) hears them alongside your voice,
while you monitor playback through your headphones.

%prep
# Nothing to unpack via %%setup - Source0 is a .deb, not a source tarball.

%build
# Nothing to compile.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}

pushd %{_builddir}
ar x %{SOURCE0}
tar xf data.tar.* -C %{buildroot}
popd

install -d %{buildroot}%{_bindir}
ln -sf /opt/Noisitron/noisitron %{buildroot}%{_bindir}/noisitron

find %{buildroot} \( -type f -o -type l \) | sed "s|^%{buildroot}||" > %{_builddir}/noisitron.filelist

%files -f %{_builddir}/noisitron.filelist

%changelog
* Thu Aug 27 2026 leafyalex <alex.dial@outlook.com> - 0.3.0-1
- New upstream release: Sound Store (MyInstants search/download).
