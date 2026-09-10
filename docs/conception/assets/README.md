# À ta soif · assets de design

Direction retenue : **Nuit**. Source de vérité visuelle : `AtaSoif-Nuit.dc.html`
(design system + 12 maquettes) et `AtaSoif-Assets.dc.html` (marque).

App **mobile et tablette uniquement** (Angular + Capacitor iOS/Android). Aucune cible desktop.

## Règles non négociables

- Rayon `0` partout. Aucune ombre portée. Aucun dégradé décoratif.
- Trait `1.5px` (`2.5px` pour un état actif), couleur `#3E362C` ou `#F2EADC` selon le poids voulu.
- L'ambre `#E39A3C` est le **seul** accent : état actif, niveau de liquide, bouton primaire. Rien d'autre.
- Trois familles, trois rôles : Bricolage Grotesque 800 (titres, en capitales),
  Schibsted Grotesk (corps et UI), Space Mono (chiffres, dates, prix, tampons, labels).
- Pas de cadratin dans les libellés d'interface : utiliser `·`, `:` ou deux phrases.
- Pas d'emoji.
- L'objet graphique central est la **jauge de niveau** : contour ivoire, remplissage ambre.
  Elle apparaît sur chaque bouteille entamée et dans le logo.

## Tokens

`_tokens.scss` remplace `apps/web/src/styles/_tokens.scss`. Tout est en variables CSS,
donc consommable directement dans les composants Angular sans build particulier.

## Écrans · `screens/`

PNG à 2x (786 × 1694 pour le mobile, 1674 × 2230 pour la tablette).

| Fichier | Écran | Route suggérée |
| --- | --- | --- |
| `01-onboarding.png` | Accueil non connecté | `/` |
| `02-auth.png` | Inscription et connexion | `/auth` |
| `03-ma-cave.png` | Liste de la cave, filtres, compteur freemium | `/cave` |
| `04-detail-bouteille.png` | Fiche d'une bouteille, ticket, niveau | `/cave/:id` |
| `05-ajout-recherche.png` | Ajout étape 1, recherche catalogue | `/ajout` |
| `06-ajout-prefill.png` | Ajout étape 2, le souvenir | `/ajout/:catalogueId` |
| `07-catalogue.png` | Catalogue public | `/catalogue` |
| `08-paywall.png` | Cave pleine, offres | `/premium` |
| `09-amis.png` | Amis, demandes, lien d'invitation | `/amis` |
| `10-cave-ami.png` | Cave d'un ami en lecture seule | `/amis/:pseudo` |
| `11-partage.png` | Visibilité, blocages, RGPD | `/reglages/partage` |
| `12-tablette-ma-cave.png` | Tablette : rail latéral, grille 2 colonnes | `/cave` |

Navigation : 5 destinations · MA CAVE / CATALOGUE / **+** / AMIS / MOI.
Actif = trait ambre 3px au-dessus de l'onglet + label ambre gras. Le bouton d'ajout est le
seul aplat plein de la barre.

## Marque · `brand/` et racine

| Fichier | Usage |
| --- | --- |
| `atasoif-mark.svg` | Marque seule, ivoire et ambre. Géométrie pure, pas de texte. |
| `atasoif-mark-mono.svg` | Marque en `currentColor`, pour hériter la couleur du contexte. |
| `atasoif-icon.svg` | Icône carrée 1024, fond compris. Source des dérivés. |
| `atasoif-icon-adaptive-foreground.svg` | Android adaptatif, premier plan, zone sûre 66dp. |
| `atasoif-icon-adaptive-background.svg` | Android adaptatif, fond uni. |
| `brand/icon-{48…1024}.png` | Dérivés pour les manifestes iOS, Android et PWA. |
| `brand/logo-horizontal.png` | Lockup principal, fond sombre. |
| `brand/logo-vertical.png` | Lockup centré, store et écran d'accueil. |
| `brand/logo-inline.png` | Une ligne, en-têtes d'app. |
| `brand/logo-fond-clair.png` | Version fond clair, impression. |
| `brand/logo-monochrome.png` | Une seule couleur, tampon ou gravure. |
| `brand/splash-ios-1284x2778.png` | Splash iOS. |
| `brand/splash-android-1080x2340.png` | Splash Android. |
| `brand/icones-interface.png` | Planche des 10 icônes d'interface, grille 24px, trait 2px. |
| `brand/tampons-categories.png` | Planche des tampons de catégorie et d'état. |

Zone de protection du logo : la hauteur du goulot sur les quatre côtés.
Taille minimale : marque seule 24px, lockup une ligne 120px de large.
Interdits : rotation, dégradé, ombre, contour ambre, niveau différent de 62 %.

## Splash et démarrage

Le fond du splash et le fond de l'app sont le même `#0E0C0A` : pas de flash blanc.
Côté Capacitor, aligner `backgroundColor` et passer la barre de statut en style clair.
Au premier rendu, la jauge monte de 10 % à 62 % en 480ms, courbe `cubic-bezier(.16,1,.3,1)`.

## Ce qui n'est pas fourni

Les photos de bouteilles sont des **placeholders rayés** dans les maquettes
(`repeating-linear-gradient` sur `#1F1B15` / `#282218`). Elles ne se shippent pas :
prévoir de vraies photos ou un composant de placeholder qui reprend ce motif,
ratio 3:4 pour le détail, carré tronqué à gauche pour les listes.
