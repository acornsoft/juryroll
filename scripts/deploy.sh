#!/usr/bin/env bash
# Deploy the production Static Web App from this machine.
# Reads SWA_CLI_DEPLOYMENT_TOKEN from the environment, or from an untracked
# .env.local when that file is present. Does not print the token.
# The token is never put on a command line, where it would show in the process
# list. The SWA CLI reads SWA_CLI_DEPLOYMENT_TOKEN from its environment and
# hands it to StaticSitesClient through the environment as well.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if [[ -z "${SWA_CLI_DEPLOYMENT_TOKEN:-}" && -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${SWA_CLI_DEPLOYMENT_TOKEN:-}" ]]; then
  echo "SWA_CLI_DEPLOYMENT_TOKEN is missing. Export it, or set it in an untracked .env.local, then run npm run deploy." >&2
  exit 1
fi
export SWA_CLI_DEPLOYMENT_TOKEN

python3 shared/rules/validate.py
npm ci
npm test
npm run build
npx @azure/static-web-apps-cli deploy app/dist --env production
