#!/usr/bin/env bash
set -euo pipefail
mkdir -p tools
mv scripts/*.js tools/ || true
echo "Moved scripts to tools/"

