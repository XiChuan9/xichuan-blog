#!/usr/bin/env bash

set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required for secret scanning." >&2
  exit 1
fi

PATTERNS=(
  'sk-[A-Za-z0-9_-]{20,}'
  'xox[baprs]-[A-Za-z0-9-]{20,}'
  'gh[pousr]_[A-Za-z0-9_]{30,}'
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_-]{35}'
  '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
)

EXCLUDES=(
  '--glob=!node_modules/**'
  '--glob=!.next/**'
  '--glob=!.open-next/**'
  '--glob=!dist/**'
  '--glob=!coverage/**'
  '--glob=!package-lock.json'
  '--glob=!*.log'
)

found=0
for pattern in "${PATTERNS[@]}"; do
  if rg --hidden --line-number --no-heading "${EXCLUDES[@]}" -- "${pattern}" .; then
    found=1
  fi
done

if [[ "${found}" -ne 0 ]]; then
  echo "Potential secret patterns detected. Review the matches above." >&2
  exit 1
fi

echo "Secret scan passed."
