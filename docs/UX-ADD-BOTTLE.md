# UX — Add bottle (conversion path)

Goal: add a bottle in **under 30 seconds**.  
This is the funnel that moves users from 0 → 10 → paywall.

## Flow

```
[Search] ──hit──► [Editable prefill] ──► [Confirm]
    │                      ▲
    └──miss──► [Create entry]─┘
```

## Rules

1. **Search first** — single field, ~250ms debounce, instant results (name, brand, barcode).
2. **Catalog hit** — prefills name, brand, origin, abv, volume, photo, attrs.
3. **Everything is editable** — note, review, price paid, and catalog fields via *overrides* (`nameOverride`, `photoUrlOverride`, …). The global catalog row is not overwritten by default.
4. **Photo** — keep catalog photo or replace (upload). Immediate preview.
5. **Miss** — “Not found? Add it” → create `Bottle` (`source=user`) + `UserBottle`.
6. **Gate at 10** — on the 11th attempt: subscription paywall (monthly / yearly). Show counter earlier (e.g. `7/10`).
7. **Errors** — short messages, never a wall of validation.

## Anti-patterns

- 15-field form before search
- Read-only catalog hit (“it’s in the DB, deal with it”)
- Surprise paywall without a counter
- Too many stacked steps / modals

## Copy (tone)

- Informal French “tu”, short, slightly cheeky
- Paywall example: “Cave pleine — passe premium pour continuer” (not “limite atteinte”)
