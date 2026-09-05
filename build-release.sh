#!/usr/bin/env bash
set -e
python3 -m py_compile backend/*.py backend/telegram_bot/*.py
node --check /tmp/fenix.js 2>/dev/null || true
if command -v gradle >/dev/null 2>&1; then (cd android && gradle assembleDebug bundleRelease); else echo 'Gradle is not installed; Android binaries were not compiled in this environment.'; fi
