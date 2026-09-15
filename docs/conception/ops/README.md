# Ops · dashboard admin À ta soif

Back-office desktop 1440. Direction visuelle **Nuit**, identique à l'app.
Source de vérité : `AtaSoif-Admin.dc.html` à la racine du projet.

Les tokens de couleur, typo et espacement sont ceux de `assets/_tokens.scss`.
Rien de nouveau n'a été introduit ici : mêmes variables, mêmes règles.

## Ce qu'il y a dans ce dossier

| Fichier | Contenu |
| --- | --- |
| `admin-dashboard.html` | Le dashboard complet, autonome, ouvrable hors ligne. Navigation cliquable entre les 10 pages. |
| `screens/*.png` | Les 10 pages en PNG 2x, 2880px de large. |

## Pages · `screens/`

| Fichier | Page | Route suggérée |
| --- | --- | --- |
| `01-vue-ensemble.png` | KPIs du jour, file de décisions | `/admin` |
| `02-revenus.png` | MRR, ARR, ARPU, LTV, churn, motifs de résiliation | `/admin/revenus` |
| `03-conversion.png` | Entonnoir inscription → abonnement | `/admin/conversion` |
| `04-acquisition.png` | Sources, CAC, activation, plateformes | `/admin/acquisition` |
| `05-retention.png` | Cohortes mensuelles, seuils, effet du social | `/admin/retention` |
| `06-utilisateurs.png` | Recherche, table, fiche compte, actions | `/admin/utilisateurs` |
| `07-habitudes.png` | Top bouteilles, prix, lieux d'achat, durées | `/admin/habitudes` |
| `08-catalogue.png` | File de modération, fusion de doublons | `/admin/catalogue` |
| `09-social.png` | Impact du social, invitations, signalements | `/admin/social` |
| `10-technique.png` | Endpoints, erreurs, versions, incidents | `/admin/technique` |

## Structure de la navigation

Rail latéral 216px, quatre groupes : **Argent**, **Audience**, **Contenu**, **Système**.
État actif = trait ambre 3px à gauche + libellé ambre + fond `#17140F`.
Les compteurs dans le rail (23 fiches à modérer, 4 signalements) sont des badges live,
pas de la décoration : ils disparaissent quand la file est vide.

## Actions disponibles

Elles sont maquettées et doivent toutes passer par un journal d'administration
horodaté avec l'identifiant de l'admin :

- valider, corriger ou refuser une fiche catalogue
- fusionner deux doublons (la fiche la plus utilisée gagne, l'autre est redirigée)
- offrir le premium à un compte
- suspendre ou bloquer un compte
- classer ou traiter un signalement
- exporter la vue courante en CSV

## Sur les chiffres

Toutes les données sont des **exemples cohérents entre eux**, pas des vraies mesures.
Ils servent à valider la densité et la hiérarchie, à remplacer par tes requêtes.

Trois lectures sont volontairement mises en avant par la mise en page, parce qu'elles
décident du produit :

1. **Le seuil de rétention est à 4 bouteilles.** En dessous, la rétention à 3 mois
   s'effondre (11% à 1 bouteille). Au-dessus de 7, elle dépasse 74%.
2. **Un seul ami double tout** · rétention, taille de cave, conversion, sessions.
   71% des comptes n'ont aucun ami : c'est le plus gros gisement du produit.
3. **L'annuel churne trois fois moins que le mensuel** et vaut 2,7 fois plus.
   Le pousser au moment du blocage 10/10 est le levier le plus rentable.

## Ce qui n'est pas maquetté

Authentification admin, gestion des rôles, et le journal d'administration lui-même.
À décider avant le développement : un seul admin ou plusieurs, et si les actions
destructrices demandent une double confirmation.
