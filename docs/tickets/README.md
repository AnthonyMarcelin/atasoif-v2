# Tickets index

Orchestrator breaks epics into tickets here. Sub-agents pick **one ticket per thread**.

| Epic | File | Sprint focus |
|---|---|---|
| E0 Platform foundation | Closed (local) — E0.6 OVH later | S0 ✅ |
| E1 Identity & access | [`E1-identity.md`](./E1-identity.md) | S1 (+ T09 in S5) |

## Rules for workers

1. Read the ticket + `.cursor/rules/90-project-context.mdc`
2. Branch from `dev`: `feature/<epic>-<ticket-slug>`
3. Implement **only** that ticket’s scope
4. PR → `dev`, Conventional Commits EN, no AI co-author
5. Report AC status + checks run

## Status legend (update in epic ticket files)

- `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` cancelled
