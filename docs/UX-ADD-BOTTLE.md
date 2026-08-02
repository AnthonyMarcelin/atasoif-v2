# UX — Ajout bouteille (chemin conversion)

Objectif : ajouter une bouteille en **moins de 30 secondes**.  
C’est le funnel qui fait passer de 0 → 10 → paywall.

## Flow

```
[Rechercher] ──hit──► [Prérempli éditable] ──► [Confirmer]
     │                        ▲
     └──miss──► [Créer fiche]─┘
```

## Règles

1. **Search first** — champ unique, debounce ~250ms, résultats instantanés (nom, marque, barcode).
2. **Hit catalogue** — préremplit name, brand, origin, abv, volume, photo, attrs.
3. **Tout est éditable** — note, avis, prix payé, et aussi les champs catalogue via *overrides* (`nameOverride`, `photoUrlOverride`, …). La fiche globale n’est pas écrasée par défaut.
4. **Photo** — garder la photo catalogue ou remplacer (upload). Preview immédiate.
5. **Miss** — “Pas trouvé ? Ajouter” → crée `Bottle` (source=`user`) + `UserBottle`.
6. **Gate 10** — au 11e essai : paywall abo (mensuel / annuel). Compteur visible avant (ex. `7/10`).
7. **Erreurs** — messages courts, jamais de mur de validation.

## Anti-patterns

- Formulaire 15 champs avant la recherche
- Fiche catalogue non modifiable (“c’est dans la base, point”)
- Paywall surprise sans compteur
- Trop d’étapes / modales empilées

## Copy (ton)

- Tutoiement, court, un peu insolent
- Paywall : “Cave pleine — passe premium pour continuer” (pas “limite atteinte”)
