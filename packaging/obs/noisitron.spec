Name:           noisitron
Version:        0.4.2
Release:        1
Summary:        Soundboard that mixes clips into a virtual mic for Discord

License:        GPL-3.0-only
URL:            https://noisitron.com
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
# Every parent directory needs explicit %dir ownership too, or OBS's filelist lint fails the
# build with "directories not owned by a package" - plain rpmbuild doesn't enforce this, so
# this went unnoticed until it actually ran on OBS. Excludes standard FHS directories that
# are always owned by the `filesystem` package - claiming those ourselves is a *different*
# rpmlint error (standard-dir-owned-by-package), not a fix for this one.
find %{buildroot} -mindepth 1 -type d \
  | sed "s|^%{buildroot}||" \
  | grep -vE '^/(opt|usr|usr/bin|usr/share|usr/share/doc|usr/share/icons)$' \
  | sed "s|^|%dir |" >> %{_builddir}/noisitron.filelist

%files -f %{_builddir}/noisitron.filelist

%changelog
* Thu Aug 27 2026 leafyalex <alex.dial@outlook.com> - 0.3.0-1
- New upstream release: Sound Store (MyInstants search/download).
