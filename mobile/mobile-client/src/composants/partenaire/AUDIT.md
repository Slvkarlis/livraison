# Espace partenaire — audit et exécution

Branche : `feat/partenaire-centre-controle`, créée depuis `feat/interface-b2b`.

## État initial exécuté

- `npm.cmd install` dans `mobile/` : réussi, 825 paquets audités ; 38 vulnérabilités (1 faible, 37 modérées) préexistantes.
- `npm.cmd run typecheck` : code 0, client + livreur + shared.
- `npm.cmd run lint` : code 0, client + livreur + shared.
- `npm.ps1` bloqué par la stratégie PowerShell ; utilisation de `npm.cmd`, sans modifier la stratégie.

## Audit du code avant modification

1. **Commandes** : filtres horizontaux existants mais pas de compteur quotidien ni de minuteur ; les cartes donnent le montant total incluant les frais. La décision se trouve après les articles et les montants dans le détail. Priorité : décision visible et grandes cibles.
2. **Disponibilité** : la pause 15/30/60 min existe, l'ouverture reste dans Profil. Les puces de pause sont petites et sans rôle accessible. Réunir ouverture et pause sans confondre fermeture et pause automatique.
3. **Détail** : historique, notes, préparation, ajustements et impression existent. Long défilement linéaire ; aucune reprise après échec initial. Réutiliser ces actions dans un panneau à trois positions avec commandes accessibles.
4. **Catalogue** : formulaire au-dessus de toute la liste, indisponibilité nécessite un rechargement complet. Recherche absente. Créer un composant dans le périmètre partenaire et changer seulement la réexportation de son onglet.
5. **Ventes et profil** : chiffres métier existants, dates libres et meilleurs produits. Absence de comparaison, réglages d'alertes et réduction du mouvement. Trop de bandeaux 3D répétés : conserver un seul sur Commandes.
6. **États et accessibilité** : spinners présents, peu de squelettes et actions de reprise ; couleurs littérales, puces sous 48 dp, animations sans préférence utilisateur dans mouvement/glisser. Ne pas déduire la conformité AA d'une capture : contrôler également les couleurs et les interactions.

Cet audit initial est fondé sur le code. Les captures Chrome à 390 px utilisent des réponses API simulées dans le script de vérification, pas un backend démarré. Playwright n'est pas installé. Aucune performance sur appareil ni accessibilité avec lecteur d'écran n'est présumée vérifiée.

## Réutilisation et limites des contrats

- Réutiliser `useTheme`, `Carte`, `Champ`, `Bouton`, `EntreeAnimee`, `GlisserPourConfirmer`, `Ville3D`, les abonnements temps réel et toutes les méthodes `api.*` existantes.
- `CommandeDetail` ne fournit pas l'échéance d'acceptation, l'ETA au commerce ou la plaque. Afficher l'attente écoulée, le prénom réel du livreur et le code de collecte issu de `etiquetteColis`, sans délai fictif.
- `Produit` n'a ni photo ni catégorie : initiale et filtre de disponibilité.
- Les ventes sont agrégées par période : séries journalières obtenues via l'endpoint existant. SVG est déjà installé ; pas besoin de Skia pour un graphique de barres.
- Horaires lisibles via `boutique()`, aucun endpoint de modification fourni.
- Pas de modèles GLB/Three.js. La ville existante est en SVG ; limiter son mouvement plutôt que promettre 60 fps non mesurés.

## Plan par commit

0. Cet audit, les preuves initiales et le script de capture.
1. Commandes : ouverture, pipeline, minuteurs, priorité des nouvelles commandes, alertes réglables, fondations accessibles.
2. Détail et étiquette : panneau à trois positions, préparation animée, code de remise, reprise d'erreur et impression conservée.
3. Catalogue : recherche, filtre, disponibilité optimiste avec restauration après erreur, formulaire en panneau.
4. Ventes : périodes rapides, comparaison, graphique journalier et compteurs courts.
5. Profil : commerce, horaires, préférences persistées, structure de langue française / future RTL.

Les modifications utilisateur de `backend/pom.xml` et les journaux JVM hors périmètre sont laissés intacts.
