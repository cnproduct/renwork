#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../../.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

rendered="$tmp_dir/rendered.yaml"
helm template openwork-ee "$chart_dir" --set inference.enabled=true > "$rendered"

for image in renwork-den-api renwork-den-web renwork-inference; do
  grep -Fq "image: \"ghcr.io/cnproduct/${image}:" "$rendered"
done

workflow="$repo_root/.github/workflows/publish-ee-images.yml"
for image in renwork-den-api renwork-den-web renwork-den-gateway renwork-inference; do
  grep -Fq -- "- image: ${image}" "$workflow"
done

if grep -Eq -- '- image: openwork-(den-api|den-web|den-gateway|inference)$' "$workflow"; then
  echo "Legacy openwork-* packages must not be publish targets" >&2
  exit 1
fi

grep -Fq 'org.opencontainers.image.source=https://github.com/${{ github.repository }}' "$workflow"

printf 'RenWork image publication checks passed\n'
