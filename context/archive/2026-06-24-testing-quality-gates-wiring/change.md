---
change_id: testing-quality-gates-wiring
title: Test-Rollout Phase 3 — Quality-gates wiring (CI test-gate before deploy)
status: archived
created: 2026-06-24
updated: 2026-06-25
archived_at: 2026-06-25T03:42:42Z
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Quality-gates wiring".
Risks covered: cross-cutting (locks the floor under Risks #1–#5 — see §2 Risk Map).
Test types planned: CI quality gates (npm run test as pre-deploy gate), optional two-account Playwright e2e smoke.
Risk response intent:

- Make `npm run test` (unit + integration) a required CI gate BEFORE the Cloudflare deploy job, so a red test blocks the deploy — closes the archived S-01 "CI lint-fail silently skips deploy" gap.
- Optionally consolidate the ad-hoc two-account RLS matrix into a wired Playwright smoke (only if it adds signal beyond the integration layer).
  After creating the folder, follow the downstream continuation rule.
