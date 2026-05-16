## Summary

<!-- What changed and why (1–3 sentences). -->

## Type

- [ ] Feature (`feat`)
- [ ] Fix (`fix`)
- [ ] Chore / docs / refactor
- [ ] Release (`develop` → `main` only)

## Test plan

- [ ] `pnpm lint` / `pnpm typecheck` (pre-commit runs lint)
- [ ] `pnpm --filter @navomnis/api test`
- [ ] Integration: `RUN_INTEGRATION=1 pnpm --filter @navomnis/api run test:integration` (Postgres + Redis)
- [ ] Manual / staging (if UI or auth): steps below

<!-- List concrete steps or "N/A — docs only". -->

## Scope guard

- [ ] No unrelated refactors
- [ ] Open Finance / banking unchanged or behind `OPEN_FINANCE_ENABLED` (if touched)
- [ ] V1 pilot scope respected ([v1-release-notes-internal.md](../docs/v1-release-notes-internal.md))

## Links

<!-- Issue / audit / design doc, e.g. docs/erp-v1-slice-design.md -->
