#!/bin/sh
# Makes `noisitron` available as a plain command (Stream Deck buttons, shell
# aliases, etc.) without users needing to know or hard-code /opt/Noisitron/...
ln -sf /opt/Noisitron/noisitron /usr/bin/noisitron
