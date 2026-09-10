# Design — Direction Nuit (retenue)

**Source of truth**
- Maquettes + DS interactif : `docs/conception/design-system/AtaSoif-Nuit.dc.html`
- Assets livrables (PNG, SVG, splash, routes) : `docs/conception/assets/` (+ `README.md`)
- Tokens runtime : `apps/web/src/styles/_tokens.scss` (copie des tokens Nuit)

Marque régénérable : `docs/conception/design-system/AtaSoif-Assets.dc.html` (lockups, icônes, splash).

## Intent

Cave nocturne + rigueur de carnet. Premium sombre, accent ambre unique, mobile / tablette only (Angular + Capacitor).  
Différencie de Vivino (clair) et des apps spiritueuses génériques.

## Tokens

Déjà dans `apps/web/src/styles/_tokens.scss` (pack Nuit).

| Role | Value |
|---|---|
| Accent | `#E39A3C` (ambre unique) |
| Fonds | `#0E0C0A` / surfaces sombres |
| Radius | **0** |
| Shadows | **aucune** |
| Trait | 1,5px (actif 2,5px) |

## Typography (Nuit)

- Titres : **Bricolage Grotesque 800**
- UI : **Schibsted Grotesk**
- Données (prix, degrés, dates) : **Space Mono**

## UI rules

- Une intention par écran
- CTA primaire ambre, secondaire contour clair
- Compteur freemium toujours visible en cave (`x/10`)
- Pas de cadratin (—) dans les libellés : préférer `·`, `:`, virgule
- Copy client : français, tutoiement, ton direct

## Photos de bouteilles

Décision produit : **les deux**.
1. Composant Angular de **fallback rayé** (motif maquette, ratio 3:4 détail / carré listes) quand `photoUrl` est absente.
2. Vraies images dès qu’elles existent : upload user + seed catalogue (Open Food Facts / E3) — le placeholder ne se shippe que comme fallback.

## Écrans

Voir table écran → route dans `docs/conception/assets/README.md` (12 PNG + navigation 5 onglets).

## Copy / i18n

- Client-facing : French only for MVP (informal “tu”)
- Code / docs / commits : English
