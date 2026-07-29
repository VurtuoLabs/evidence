#!/usr/bin/env bash
set -euo pipefail

# Evidence - seed demo data (CONTRACT §13).
#
# Produces ~500 hash-chained decisions across three of the org's real Agentforce
# agents, the six-panel children for the most recent of them, one active legal
# hold, a daily anchor per chain, and one deliberate chain break so the
# verification demo has something to find. The subject throughout is "Alex".
#
# Usage:
#   bash scripts/seed.sh                 # seed the org aliased "evidence"
#   ALIAS=my-org bash scripts/seed.sh    # seed a different org
#   BATCHES=4 bash scripts/seed.sh       # fewer decisions, faster
#
# Decisions are appended in batches, one anonymous Apex execution each. That is
# not arbitrary: Decision_Ledger__b is a Big Object, and Database.insertImmediate
# fails with "pending uncommitted work" if ordinary DML has already run in the
# same transaction. One capture call per transaction keeps the Big Object write
# first. Each batch continues the chains from their current terminal position, so
# positions stay monotonic and gap-free across runs.

ALIAS="${ALIAS:-evidence}"
BATCHES="${BATCHES:-10}"
SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/seed"

run_step() {
  echo "==> $2"
  sf apex run --file "${SEED_DIR}/$1" --target-org "${ALIAS}" 2>&1 \
    | sed -n 's/.*USER_DEBUG|\[[0-9]*\]|DEBUG|/    /p'
}

echo "==> Appending decisions in ${BATCHES} batches (51 per batch)..."
for i in $(seq 1 "${BATCHES}"); do
  printf '    batch %2d/%s ' "${i}" "${BATCHES}"
  sf apex run --file "${SEED_DIR}/01_decisions.apex" --target-org "${ALIAS}" 2>&1 \
    | sed -n 's/.*USER_DEBUG|\[[0-9]*\]|DEBUG|Decisions written this batch: /-> /p'
done

run_step "02_children.apex"               "Seeding rationales, considerations and policy checks"
run_step "03_legal_hold.apex"             "Issuing the legal hold"
run_step "04_anchors.apex"                "Anchoring each chain"
run_step "05_chain_break.apex"            "Seeding the deliberate chain break"

# One chain per execution: verify() reads a Big Object and then writes, and a Big
# Object read cannot follow DML in the same transaction.
echo "==> Verifying each chain"
for _ in 1 2 3; do
  sf apex run --file "${SEED_DIR}/06_verify_one_chain.apex" --target-org "${ALIAS}" 2>&1 \
    | sed -n 's/.*USER_DEBUG|\[[0-9]*\]|DEBUG|/    /p'
done

echo
echo "==> Seed complete. Open the console with:"
echo "    sf org open --target-org ${ALIAS} --path lightning/app/Evidence"
