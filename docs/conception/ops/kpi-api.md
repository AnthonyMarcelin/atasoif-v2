# Ops KPI read API (E2-T09)

Thin JSON for the ops mockups. No admin UI. Mockup numbers in `admin-dashboard.html` stay examples.

## Endpoint

`GET /api/v1/ops/kpis`

One payload, three sections:

| JSON | Mockup page | What is live in E2 |
| --- | --- | --- |
| `overview` | Vue d'ensemble | Bottles added today, bottles in cellar, bottles / user |
| `conversion` | Conversion | Cellar funnel stages from users + `user_bottles` |
| `habitudes` | Habitudes | Aggregates on `user_bottles` |

`generatedAt` is UTC ISO-8601.

Each metric has `status`: `live` or `stub`. A stub has `value: null` (or `count` / `percent` null on a funnel step) and a `reasonCode`. Do not chart stubs as measurements.

`label` matches the mockup wording.

## Protection

Header `X-Ops-Token` must equal env `OPS_ADMIN_TOKEN`.

- User `Authorization: Bearer` tokens do not grant access.
- Empty or unset `OPS_ADMIN_TOKEN` fails closed (401 `E_OPS_UNAUTHORIZED`), same body as a wrong token.
- Payloads omit emails, passwords, tokens, and payment provider ids.
- IP throttle: 60 requests / minute (disabled in the test suite).

Set a long random value in production. Docker passes `OPS_ADMIN_TOKEN` through (empty default).

## Live definitions

Counts include every account, including cellars of size 0. Mean and median of "bouteilles / user" and "par utilisateur" use that population.

| Field | Rule |
| --- | --- |
| `overview.bottlesAddedToday` | `user_bottles.created_at` from the current UTC day |
| `overview.bottlesTotal` / `habitudes.bottlesInCellar` | Row count of `user_bottles` |
| Conversion `window.id` | `all_time`. The mockup "mesuré à 30 jours" is `measuredAt30Days` (stub) |
| `account_created` | All users |
| `first_bottle` | Users with at least 1 cellar row (`threshold` 1) |
| `three_bottles` | Users with at least 3 (`threshold` 3) |
| `cellar_full` | Users with at least `FREE_BOTTLE_LIMIT` (10). Label: Cave pleine · 10/10 |
| Funnel `percent` | Share of `account_created`, one decimal |
| `lostFromPreviousPercent` | Share lost from the previous live stage. Null on the first stage and on stubs |
| `finished` | `fill_level === 0`, share of cellar rows |
| `levelUpdates` | Mean and sum of `fill_level_updates_count` |
| `withWrittenReview` | `review` non-null after trim. Whitespace-only does not count |
| `averageNote` | Mean of non-null `note`. Scale is not locked (mockup "sur 5" is not applied) |
| `averagePrice` | Mean and median of non-null `price_paid` |
| `priceDistribution` | Half-open cuts: `[0,10)`, `[10,25)`, `[25,50)`, `[50,80)`, `[80,150)`, `[150, inf)`. `0-10` is extra so cheap bottles are not dropped. Percents use priced rows only |
| `purchasePlaces` | Top 10 of trimmed `bought_at` (exact text, not a place enum). `percent` uses every non-blank place, including rows past the top 10 |
| `topBottles` | Top 10 catalog bottles by cellar count. Name is `bottles.name` |

## Stubs

| `reasonCode` | Fields |
| --- | --- |
| `no_session_analytics` | `overview.sessionsPerWeek` |
| `billing_not_implemented` | `overview.revenue`, `delayBeforeSubscription`, `planMix`, `subscription_paid`, `habitudes.priceByPlan` |
| `paywall_events_not_tracked` | `paywall_viewed`, `subscriptionTriggers` |
| `cohort_window_not_implemented` | `measuredAt30Days` |
| `no_open_or_finished_timestamp` | `bottleLifetimeDays` (no opened-at or finished-at; `fill_level === 0` is only the finished flag) |
| `same_bottle_row_unique` | `repurchase` (`user_bottles` is unique on `user_id` + `bottle_id`, so a second personal row for the same catalog bottle cannot be stored) |

Out of this payload until a later epic: acquisition, retention cohorts, user admin, catalogue moderation, social, revenue widgets (MRR, ARR, ARPU, LTV, churn), technique beyond `GET /health`.

## Product readings (not metrics)

Kept from the ops README. They are not fields on this API:

1. Retention cliff under 4 bottles.
2. Annual vs monthly churn (billing, later).
3. Social lift from one friend (E6).
