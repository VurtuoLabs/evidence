#!/usr/bin/env bash
#
# deploy.sh - build the Evidence UI Bundle, then deploy force-app to the org.
#
# Usage:
#   bash scripts/deploy.sh                # build UI, deploy, assign base permset
#   bash scripts/deploy.sh --no-ui        # skip the UI build (deploy source as-is)
#   bash scripts/deploy.sh --check        # validate-only (dry run), no changes committed
#   bash scripts/deploy.sh --check --no-ui
#
set -euo pipefail

ALIAS="evidence"
UI_DIR="force-app/main/default/uiBundles/evidenceUi"
BASE_PERMSET="Evidence_Analyst"

BUILD_UI=1
CHECK=0

for arg in "$@"; do
  case "${arg}" in
    --no-ui) BUILD_UI=0 ;;
    --check|--dry-run) CHECK=1 ;;
    *) echo "Unknown option: ${arg}" >&2; exit 2 ;;
  esac
done

# 1. Build the React UI Bundle (emits dist/ that the deploy picks up).
if [[ "${BUILD_UI}" == "1" ]]; then
  echo "==> Building UI Bundle (${UI_DIR})."
  if [[ ! -d "${UI_DIR}/node_modules" ]]; then
    echo "==> Installing UI dependencies (first run)."
    npm --prefix "${UI_DIR}" install
  fi
  npm --prefix "${UI_DIR}" run build
else
  echo "==> Skipping UI build (--no-ui)."
fi

# 2. Deploy metadata.
DEPLOY_ARGS=(--source-dir force-app --target-org "${ALIAS}" --wait 30)
if [[ "${CHECK}" == "1" ]]; then
  echo "==> Validating deployment (dry run, nothing committed)."
  DEPLOY_ARGS+=(--dry-run)
else
  echo "==> Deploying force-app to '${ALIAS}'."
fi
sf project deploy start "${DEPLOY_ARGS[@]}"

# 3. Assign the base permission set (skipped on a dry run - nothing was deployed).
if [[ "${CHECK}" != "1" ]]; then
  echo "==> Assigning base permission set '${BASE_PERMSET}'."
  sf org assign permset --name "${BASE_PERMSET}" --target-org "${ALIAS}" \
    || echo "    (permission set may already be assigned - continuing)"
  echo "==> Deploy complete. Open with: sf org open --path lightning/app/Evidence"
else
  echo "==> Validation complete. No metadata was committed."
fi
