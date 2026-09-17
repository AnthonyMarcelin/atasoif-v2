# Tickets index

Orchestrator breaks epics into tickets here. Sub-agents pick **one ticket per thread**.

| Epic | File | Sprint focus |
|---|---|---|
| E0 Platform foundation | Closed locally — E0.7 OVH/TLS later | S0 ✅ · [`E0-docker.md`](./E0-docker.md) |
| E1 Identity & access | [`E1-identity.md`](./E1-identity.md) | S1 (+ T09 in S5) |
| E2 Memory cellar | [`E2-memory-cellar.md`](./E2-memory-cellar.md) | S2 (T01–T09 Must · T10 Should · T11–T12 later) |

DB / catalog decisions (VPS DB, Lucid schema, EAN cache-first, OFF + UPCitemdb nurse): [`../DATABASE.md`](../DATABASE.md).

## Rules for workers

1. Read the ticket + `.cursor/rules/90-project-context.mdc`
2. Branch from `dev`: `feature/<epic>-<ticket-slug>`
3. Implement **only** that ticket’s scope
4. PR → `dev`, Conventional Commits EN, no AI co-author
5. Report AC status + checks run

## Status legend (update in epic ticket files)

- `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` cancelled
