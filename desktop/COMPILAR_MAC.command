#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Instale Node.js 22 LTS desde https://nodejs.org/"
  exit 1
fi
npm install
npm run dist:mac
echo "Instaladores creados dentro de desktop/release."
