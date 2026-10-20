#!/usr/bin/env bash
# Fails unless the running node, every Dockerfile's `ARG NODE_VERSION=` and the
# cimg/node tags in .circleci/config.yml all match .tool-versions.
#
# Usage: scripts/check-node-version.sh [expected-node-version]
# The argument overrides the version `node -v` must report, for CI jobs that
# deliberately run on another Node (the integration test matrix).

set -euo pipefail

cd "$(dirname "$0")/.."

# legacy_test deliberately runs the v1 CLI deploy on Node 18
EXEMPT_JOBS="legacy_test"

want=$(awk '$1 == "nodejs" { print $2 }' .tool-versions)
if [ -z "$want" ]; then
  echo "No nodejs entry in .tool-versions" >&2
  exit 1
fi
major=${want%%.*}
errors=()

expected_node=${1:-$want}
actual_node=$(node -v)
actual_node=${actual_node#v}
if [ "$actual_node" != "$expected_node" ]; then
  errors+=("node -v is $actual_node, expected $expected_node")
fi

while IFS= read -r dockerfile; do
  while IFS= read -r arg; do
    if [ "$arg" != "$want" ]; then
      errors+=("$dockerfile: ARG NODE_VERSION=$arg")
    fi
  done < <(sed -n 's/^ARG NODE_VERSION=\([^[:space:]]*\).*/\1/p' "$dockerfile")
done < <(find . -name node_modules -prune -o -name .git -prune -o -type f -name 'Dockerfile*' -print | sort)

config=.circleci/config.yml

while read -r job tag; do
  case " $EXEMPT_JOBS " in *" $job "*) continue ;; esac
  if [ "$tag" != "$want" ]; then
    errors+=("$config: job $job uses cimg/node:$tag")
  fi
done < <(awk '
  /^[^ #]/ { section = $1 }
  section == "jobs:" && /^  [A-Za-z0-9_-]+:/ { job = $1; sub(/:$/, "", job) }
  /image: *cimg\/node:/ {
    tag = $0
    sub(/.*cimg\/node:/, "", tag)
    sub(/[[:space:]].*/, "", tag)
    gsub(/["\047]/, "", tag)
    if (tag !~ /^<</) print job, tag
  }
' "$config")

matrix=$(sed -n 's/^ *node_version: *\[\(.*\)\].*/\1/p' "$config" | tr -d "\"' " | tr ',' '\n')
if ! grep -qx "$want" <<<"$matrix"; then
  errors+=("$config: node_version matrix does not include $want")
fi
while IFS= read -r v; do
  [ -z "$v" ] && continue
  if ! [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    errors+=("$config: node_version matrix entry $v is not an exact x.y.z tag")
  elif [ "${v%%.*}" = "$major" ] && [ "$v" != "$want" ]; then
    errors+=("$config: node_version matrix entry $v")
  fi
done <<<"$matrix"

if [ ${#errors[@]} -gt 0 ]; then
  echo "Node version drift: .tool-versions says $want" >&2
  printf '  %s\n' "${errors[@]}" >&2
  exit 1
fi

echo "Node pins match .tool-versions ($want), node -v is $actual_node"
