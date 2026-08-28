Name:           noisitron
Version:        0.3.0
Release:        1%{?dist}
Summary:        Soundboard that mixes clips into a virtual mic for Discord

License:        GPL-3.0-only
URL:            https://github.com/ProbAlex/Noisitron
Source0:        https://github.com/ProbAlex/Noisitron/releases/download/v%{version}/noisitron_%{version}_amd64.deb

BuildArch:      x86_64
BuildRequires:  binutils
BuildRequires:  tar

Requires:       gtk3, nss, libXScrnSaver, libXtst, libnotify, at-spi2-core, libsecret, xdg-utils, pulseaudio-libs
Suggests:       libappindicator-gtk3

# This repackages the project's own prebuilt Linux release (an Electron app)
# rather than compiling from source - there's no meaningful from-source RPM
# build for a bundled Chromium runtime. See ../aur/PKGBUILD and
# ../ppa/debian/README.source for the same approach on Arch and Ubuntu.
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
