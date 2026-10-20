#!/usr/bin/env bash
set -euo pipefail

node_version=$(awk '$1 == "nodejs" { print $2 }' .tool-versions)

. "$NVM_DIR/nvm.sh"
nvm install "$node_version"
nvm alias default "$node_version"

npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"
