Name:           noisitron
Version:        0.3.0
Release:        1%{?dist}
Summary:        Soundboard that mixes clips into a virtual mic for Discord

License:        GPL-3.0-only
URL:            https://github.com/ProbAlex/Noisitron
Source0:        https://github.com/ProbAlex/Noisitron/releases/download/v%{version}/noisitron_%{version}_amd64.deb

ExclusiveArch:  x86_64
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

# The .deb hardlinks its two copies of the icon together (same inode) to save space -
# harmless for dpkg, but rpmlint's hardlink-across-partition check flags it since /opt and
# /usr aren't guaranteed to be on the same filesystem on every install. Break any such
# hardlinks by replacing every copy past the first with a real, independent copy.
find %{buildroot} -type f -links +1 -printf '%%i\n' | sort -u | while read -r inode; do
  files=$(find %{buildroot} -type f -inum "$inode")
  first=$(echo "$files" | head -1)
  echo "$files" | tail -n +2 | while read -r f; do
    cp --remove-destination "$first" "$f"
  done
done

find %{buildroot} \( -type f -o -type l \) | sed "s|^%{buildroot}||" > %{_builddir}/noisitron.filelist
# Every parent directory needs explicit %dir ownership too, or OBS's (stricter than COPR's)
# filelist lint fails the build with "directories not owned by a package" - harmless here
# even though COPR didn't enforce it, and keeps both specs' %install identical. Excludes
# standard FHS directories that are always owned by the `filesystem` package.
find %{buildroot} -mindepth 1 -type d \
  | sed "s|^%{buildroot}||" \
  | grep -vE '^/(opt|usr|usr/bin|usr/share|usr/share/doc|usr/share/icons)$' \
  | sed "s|^|%dir |" >> %{_builddir}/noisitron.filelist

%files -f %{_builddir}/noisitron.filelist

%changelog
* Thu Aug 27 2026 leafyalex <alex.dial@outlook.com> - 0.3.0-1
- New upstream release: Sound Store (MyInstants search/download).
