#!/usr/bin/env bash
# ==============================================================================
# Magic Mail - Build & Packaging Pipeline
# Validates manifest/scripts/assets and builds the .xpi package.
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== 1. Validating Manifest & HTML References ==="
python3 -c "
import json, pathlib, re

root = pathlib.Path('.')
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
print('Manifest:', manifest['name'], manifest['version'])

missing = []
for html in root.rglob('*.html'):
    text = html.read_text(encoding='utf-8')
    for attr in ('href', 'src'):
        for m in re.finditer(rf'{attr}=\"([^\"]+)\"', text):
            val = m.group(1)
            if val.startswith(('http', 'mailto:', 'tel:', '#')):
                continue
            if not (html.parent / val).resolve().exists():
                missing.append((str(html), val))

if missing:
    raise SystemExit(f'Missing HTML asset references: {missing}')
print('All HTML asset references verified.')
"

if command -v node >/dev/null 2>&1; then
  echo -e "\n=== 2. Checking JavaScript Syntax ==="
  for f in background.js services/*.js popup/*.js options/*.js; do
    node --check "$f"
  done
  echo "All JavaScript files passed syntax check."
fi

echo -e "\n=== 3. Packaging .xpi Add-on ==="
python3 scripts/package.py

echo -e "\nBuild complete! Ready to install in Mozilla Thunderbird."
