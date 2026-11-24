#!/usr/bin/env bash
# Phase 33 packaging: Chrome MV3 extension zip + Windows agent zips, with
# SHA-256 checksums. Output lands in public/downloads and is served by the app.
set -euo pipefail
cd "$(dirname "$0")/.."

EXT=extensions/chrome
WIN=desktop/windows
OUT=public/downloads
mkdir -p "$OUT"

echo "→ Packaging Chrome MV3 extension"
rm -f "$OUT/qasyn-chrome-extension.zip"
(cd "$EXT" && zip -qr "/vercel/sandbox/repo/$OUT/qasyn-chrome-extension.zip" . -x '.*')

echo "→ Packaging Windows agent (x64 + x86)"
rm -f "$OUT/qasyn-agent-win-x64.zip" "$OUT/qasyn-agent-win-x86.zip"
(cd "$WIN" && zip -qj "/vercel/sandbox/repo/$OUT/qasyn-agent-win-x64.zip" qasyn-agent-win-x64.exe qasyn-agent/agent-cli.cmd)
(cd "$WIN" && zip -qj "/vercel/sandbox/repo/$OUT/qasyn-agent-win-x86.zip" qasyn-agent-win-x86.exe qasyn-agent/agent-cli.cmd)

echo "→ SHA-256 checksums"
(cd "$OUT" && sha256sum qasyn-chrome-extension.zip qasyn-agent-win-x64.zip qasyn-agent-win-x86.zip > SHA256SUMS.txt)
cat "$OUT/SHA256SUMS.txt"
ls -la "$OUT"
