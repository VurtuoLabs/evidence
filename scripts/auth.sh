#!/usr/bin/env bash
#
# auth.sh - create (or recreate) the Evidence scratch org and set it as default.
#
# Usage:
#   bash scripts/auth.sh                 # create a scratch org aliased "evidence"
#   DEVHUB=my-devhub bash scripts/auth.sh
#
set -euo pipefail

ALIAS="evidence"
DEVHUB="${DEVHUB:-}"
DEF="config/project-scratch-def.json"
DURATION="${DURATION:-30}"

echo "==> Evidence org bootstrap (alias: ${ALIAS})"

# Resolve a Dev Hub. Prefer an explicit DEVHUB, otherwise use the CLI default.
HUB_ARGS=()
if [[ -n "${DEVHUB}" ]]; then
  HUB_ARGS=(--target-dev-hub "${DEVHUB}")
fi

# If a scratch org already carries this alias, reuse it unless FORCE=1.
if sf org display --target-org "${ALIAS}" >/dev/null 2>&1 && [[ "${FORCE:-0}" != "1" ]]; then
  echo "==> Scratch org '${ALIAS}' already exists. Set FORCE=1 to recreate. Reusing it."
else
  if [[ "${FORCE:-0}" == "1" ]]; then
    echo "==> FORCE=1 - deleting existing '${ALIAS}' scratch org (if any)."
    sf org delete scratch --target-org "${ALIAS}" --no-prompt >/dev/null 2>&1 || true
  fi
  echo "==> Creating scratch org from ${DEF} (duration ${DURATION} days)."
  sf org create scratch \
    --definition-file "${DEF}" \
    --alias "${ALIAS}" \
    --duration-days "${DURATION}" \
    --set-default \
    "${HUB_ARGS[@]}"
fi

sf config set target-org="${ALIAS}" >/dev/null

echo "==> Done. Default org is now '${ALIAS}'."
echo "    Next: bash scripts/deploy.sh"
