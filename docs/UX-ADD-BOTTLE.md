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
2. **Catalog hit** — prefills name, brand, origin, abv, volume, **catalog photo**, attrs.
3. **Everything editable that the plan allows** — memory fields first-class: **price paid**, **where bought**, **personal note/review**. Photo replace and fill-level jauge are **premium** (free keeps catalog/seed photo; no interactive jauge).
4. **Photo** — free: catalog/DB photo only. Premium: replace (upload) with immediate preview.
5. **Miss** — “Not found? Add it” → create `Bottle` (`source=user`) + `UserBottle`.
6. **Gates** — on the 11th bottle **or** when free tries photo override / jauge: subscription paywall (monthly / yearly). Show counter earlier (e.g. `7/10`).
7. **Errors** — short messages, never a wall of validation.

Do not design this flow by copying atasoif.fr v1. Optimize for “I remember this bottle.”

## Anti-patterns

- 15-field form before search
- Read-only catalog hit (“it’s in the DB, deal with it”)
- Surprise paywall without a counter
- Hiding premium photo/jauge controls client-side without server 403
- Too many stacked steps / modals

## Copy (tone)

- Informal French “tu”, short, slightly cheeky
- Paywall example: “Cave pleine — passe premium pour continuer” (not “limite atteinte”)
- Feature upsell example: short FR for photo perso / jauge (no eng jargon)
