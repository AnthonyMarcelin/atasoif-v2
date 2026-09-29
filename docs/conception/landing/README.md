# Landing · À ta soif

Page marketing. Direction visuelle **Nuit**, identique à l'app et au back-office.
Implémentation : `apps/site` (Astro, static). Maquette source dans ce dossier.
Tokens de couleur, typo et espacement : `assets/_tokens.scss` (aussi copiés dans `apps/site/src/styles/_tokens.scss`).

## Ce qu'il y a dans ce dossier

| Fichier | Contenu |
| --- | --- |
| `landing.html` | La page complète, autonome, ouvrable hors ligne (captures d'écran incluses). |
| `screens/01-landing-desktop.png` | Page entière en 1440px de large. |
| `screens/02-hero-desktop.png` | Hero seul, 2x. |
| `screens/03-prix-desktop.png` | Section prix, 2x. |
| `screens/04-landing-mobile.png` | Page entière en 390px de large. |
| `screens/05-hero-mobile.png` | Hero mobile, 2x. |

## Structure de la page

1. **Hero** · promesse, boutons de téléchargement, trois chiffres, capture de l'écran Ma cave
2. **Ce que tu perds sans carnet** · prix, endroit, avis, ce qu'il reste
3. **Comment ça marche** · trois étapes avec les vraies captures d'écran
4. **La jauge** · ce qui distingue l'app des autres cavothèques
5. **Entre amis** · le social cadré sur la confidentialité
6. **Prix** · gratuit 10 bouteilles, annuel mis en avant, mensuel
7. **FAQ** · cinq questions
8. **Rappel à l'action** + pied de page avec la mention légale alcool

La page est **fluide**, pas en largeur fixe : elle tient de 360px à grand écran.
Les grilles utilisent `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, donc les colonnes
se replient sans point de rupture à écrire.

## À faire avant mise en ligne

- **Liens de store** · les boutons pointent sur `#ios` et `#android`. À remplacer par les
  vraies URLs App Store et Google Play.
- **Chiffres du hero** · `11 462 fiches au catalogue` vient des données d'exemple du
  dashboard. À remplacer par le vrai chiffre, ou à retirer au lancement.
- **Formulaire waitlist** · le mode `waitlist` existe encore dans le réglage `ctaMode`
  (panneau Tweaks) si tu veux une page d'attente avant la sortie. Dans ce mode, le champ
  email n'est pas branché : il faut un endpoint.
- **Captures d'écran** · celles de la page sont les maquettes, pas des captures de l'app
  réelle. À refaire depuis le vrai build avant publication.
- **Mention légale** · la mention alcool est présente en pied de page. Vérifier l'obligation
  exacte (loi Evin) selon les canaux de diffusion utilisés.
- **Métadonnées** · pas de `<title>`, de description, ni d'image de partage. À ajouter à
  l'intégration.

## Réglage disponible

`ctaMode` · `stores` (par défaut, boutons de téléchargement) ou `waitlist`
(formulaire email et mention « sortie prévue cet automne »).
