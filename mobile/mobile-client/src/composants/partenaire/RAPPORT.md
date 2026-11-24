# FleetPulse — refonte de l’espace partenaire

Branche : `feat/partenaire-centre-controle`, issue de `feat/interface-b2b`.

## Livraison par commit

### 9787c36 — audit initial

- **Changement :** audit du code avant modification, installation des dépendances existantes, typecheck et lint initiaux exécutés, captures des quatre onglets et du détail à 390 px.
- **Fichiers :** `src/composants/partenaire/AUDIT.md`, `screenshots-partenaire/verifier.cjs`, `avant-*.png`, `avant-resultats.json`.
- **Dépendances ajoutées :** aucune.
- **Limites :** audit initial du code complété par des captures Chrome avec réponses API simulées. Aucun backend n’écoutait sur le port prévu. Playwright absent : utilisation du protocole CDP de Chrome, sans installer de dépendance de test.
- **Problèmes existants signalés :** PowerShell bloque `npm.ps1` ; utiliser `npm.cmd`. Audit npm initial : 38 vulnérabilités, dont 1 faible et 37 modérées. Pas de mise à jour générale hors périmètre.

### 2c4869d — Commandes, centre de contrôle

- **Changement :** ouverture en une touche, pauses réutilisées, compteurs quotidiens, ville SVG légère unique, segments Nouvelles / En préparation / Prêtes / Récupérées et archive séparée pour refus/annulations. Cartes avec numéro monospace, heure, articles, montant et attente. Décision sur la plus ancienne nouvelle commande, temps 10/15/20/30 min ou personnalisé, refus par motif. Alertes conservées en file, retour haptique et audio local.
- **Fichiers principaux :** `CommandesRecues.tsx`, `PanneauBoutique.tsx`, `DecisionCommande.tsx`, `AlerteNouvelleCommande.tsx`, `Puce.tsx`, `EnteteCarte.tsx`, `InterfacePartenaire.tsx`, `PreferencesPartenaire.tsx`, `ReglagesAlertes.tsx`, `stockagePreferences.ts` et `.web.ts`, `app/partenaire/_layout.tsx`. Les chemins des composants sont relatifs à `src/composants/partenaire/`.
- **Partagé, strictement nécessaire :** `packages/shared/src/{ui,mouvement,glisser,ville3d}.tsx`. Réduction du mouvement système + locale, boutons accessibles, préférence de mouvement héritée, mode statique et marqueurs de ville. Aucune modification des contrats API.
- **Dépendances déclarées après accord :** `react-native-reanimated` 4.7.1, `react-native-gesture-handler` ~3.3.0, `react-native-worklets` 0.13.0, `expo-haptics` ~58.0.8. Installation par `expo install`, manifestes et lockfile mis à jour. `expo-audio` et `react-native-svg` existaient déjà.
- **Compatibilité :** versions sélectionnées par Expo 58. Les documentations [Reanimated](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/) et [Gesture Handler](https://docs.expo.dev/versions/v58.0.0/sdk/gesture-handler/) indiquent leur prise en charge dans Expo Go. Aucun module nécessitant un développement natif personnalisé n’a été ajouté ; Expo Go n’a pas été exécuté sur appareil.
- **Laissé de côté :** aucun compte à rebours d’expiration ni anneau d’acceptation trompeur : les contrats partenaire ne fournissent pas d’échéance. L’interface affiche l’attente écoulée. Aucun « livreur à 3 min » ni plaque inventée ; ces données ne sont pas exposées au partenaire.
- **Sens des chiffres :** commandes créées aujourd’hui, y compris les issues refusées/annulées ; chiffre d’affaires des articles livrés aujourd’hui, hors livraison et avant commission, fourni par l’API Ventes. Ces deux mesures ne représentent pas le même périmètre de statuts.

### 5f59058 — détail coulissant et remise

- **Changement :** panneau gestuel à trois positions, boutons alternatifs, articles et notes, décision, frise de préparation animée, ajustements existants, glisser pour confirmer et confirmation alternative en deux touches. Prénom du livreur et grand code de remise issus des API existantes. Étiquette avec reprise de chargement et retour explicite après ouverture du dialogue d’impression.
- **Fichiers :** `DetailCommandeRecue.tsx`, `PanneauCoulissant.tsx`, `SuiviPreparation.tsx`, `AnimationEtat.tsx`, `etiquette/EcranEtiquette.tsx`, ajustements de `CommandesRecues.tsx` et `Puce.tsx`, script et captures `etape2-*`.
- **Dépendances ajoutées :** aucune.
- **Réutilisation :** `GlisserPourConfirmer`, `FriseHistorique`, QR et fonctions `imprimerEtiquette.ts`, `imprimerEtiquette.web.ts`, `etiquetteHtml.ts` conservés. Les fonctions d’impression et le HTML imprimé n’ont pas été modifiés.
- **Laissé de côté :** aucune confirmation d’impression physique : le texte indique l’ouverture du dialogue. Pas de fichiers Lottie téléchargés sans licence vérifiable ; petites animations Reanimated sur les icônes existantes pour nouvelle commande, prête, aucun résultat et dialogue d’impression.
- **Vérifié dans Chrome :** les trois positions et le geste réel de poignée, erreur puis reprise d’acceptation, préparation, délai ajusté, confirmation prête, code de remise et QR visible. Les réponses serveur étaient simulées.

### 1c8464e — catalogue

- **Changement :** liste avec initiales et prix monospace, recherche, filtre Disponible / En rupture, disponibilité optimiste avec restauration après échec, annulation de la dernière modification réussie, rupture en une touche, bouton flottant et formulaire coulissant. Validation du nom et du prix, virgule décimale, saisie conservée après échec.
- **Fichiers :** nouveau `partenaire/CataloguePartenaire.tsx`, réexportation de `app/partenaire/(onglets)/catalogue.tsx`, `InterfacePartenaire.tsx`, `PanneauCoulissant.tsx`, script et preuves du catalogue `etape3-*`. L’ancien composant hors périmètre n’a pas été modifié.
- **Dépendances ajoutées :** aucune.
- **Laissé de côté :** photos et catégories de produit non exposées par le type `Produit` : initiales et filtre de disponibilité utilisés. Aucune catégorie fictive.
- **Vérifié :** recherche vide, remise à zéro des filtres, filtre de rupture, modification optimiste avec latence simulée, erreur avec restauration, annulation, formulaire invalide puis création à prix `9,500` correctement envoyé comme `9.5`.

### 1c0a7aa — ventes

- **Changement :** Aujourd’hui / 7 jours / 30 jours, comparaison avec la période précédente, panier moyen, compteur court, barres journalières et meilleurs produits. Les dates personnalisées existantes restent accessibles avec validation.
- **Fichiers :** `EcranVentes.tsx`, script et preuves Ventes `etape4-*`.
- **Dépendances ajoutées :** aucune. SVG était déjà installé : graphique simple sans coût d’installation de Skia.
- **Données :** les journées sont obtenues via l’endpoint agrégé existant, par lots de quatre journées, parallèlement aux deux totaux courant/précédent. Au maximum 32 lectures pour 30 jours ; actualisation de cet écran toutes les deux minutes, événements regroupés sur 700 ms. Pour une période personnalisée supérieure à 30 jours, le total couvre toute la période et le graphique ses 30 derniers jours.
- **Laissé de côté :** pas de répartition horaire inventée. Aujourd’hui montre le contexte des sept derniers jours et se compare à hier sur journée complète ; cette différence est indiquée.
- **Vérifié :** périodes rapides, nombre de commandes attendu, présence du SVG, dates invalides refusées, période personnalisée et reprise après erreur simulée.

### Commit Profil et vérification finale — HEAD

- **Changement :** carte du commerce, horaires réels en lecture, paramètres de son et réduction du mouvement persistés par compte, déconnexion et structure de langue `fr/ltr`, `ar/rtl` réservée sans traduction ni bascule globale. Libellé d’onglet Profil.
- **Fichiers principaux :** `ProfilPartenaire.tsx`, `ReglagesAlertes.tsx`, nouveau `InterrupteurPartenaire.tsx`, layouts partenaire, ajustements des composants Commandes, Détail, Catalogue, Préparation et Étiquette, `InterfacePartenaire.tsx`, `PanneauCoulissant.tsx`, `Puce.tsx`, `AlerteNouvelleCommande.tsx`, partagé `glisser.tsx` et `ville3d.tsx`, ce rapport et preuves finales.
- **Dépendances ajoutées :** aucune.
- **Finitions :** interrupteurs de 60 × 48 dp et retour de 48 dp, thème sur les contrôles, messages annoncés, actions secondaires contrastées, message de validation effacé lors de la correction. Fermeture des alertes distincte de la décision. Une désactivation du son interrompt aussi la lecture en attente. Les pauses restent dans Profil ; Commandes privilégie la décision. Le détail s’ouvre développé.
- **Mouvement :** la réduction système reste prioritaire. Ville SVG fixe sans boucle de géométrie en JS, points pour commandes actives, pulsation légère de connexion. Aucun GLB, Three.js ou autre moteur 3D lourd.
- **Contrastes calculés :** texte/fond 15,05:1 ; texte/ambre 9,57:1 ; texte secondaire/surface 5,05:1 ; erreur/fond erreur 4,56:1. Les petits textes sur fond graphite/clair et les actions qui échouaient de peu à AA ont été corrigés. Ceci ne constitue pas un audit complet avec lecteur d’écran.
- **Laissé de côté :** modification des horaires sans endpoint correspondant, traduction arabe, validation de RTL sur appareil, mesures FPS/consommation.

## Vérifications exécutées

Depuis `mobile/` :

```text
npm.cmd run typecheck
> mobile-client@1.0.0 typecheck
> tsc --noEmit
> mobile-livreur@1.0.0 typecheck
> tsc --noEmit
> @fleetpulse/shared@1.0.0 typecheck
> tsc --noEmit
Code de sortie : 0

npm.cmd run lint
> npm run lint -w mobile-client -w mobile-livreur && eslint packages/shared/src --config mobile-client/eslint.config.js
> mobile-client@1.0.0 lint
> expo lint
> mobile-livreur@1.0.0 lint
> expo lint
Code de sortie : 0 ; aucune erreur ni avertissement
```

Sorties complètes : [TypeScript](../../../screenshots-partenaire/verification-typecheck.txt), [lint](../../../screenshots-partenaire/verification-lint.txt), [export Android](../../../screenshots-partenaire/verification-android.txt), [parcours navigateur](../../../screenshots-partenaire/verification-navigateur.txt). Le résultat et les requêtes simulées sont dans [apres-resultats.json](../../../screenshots-partenaire/apres-resultats.json).

Commande d’export depuis `mobile/mobile-client/` :

```powershell
npx.cmd expo export --platform android --max-workers 1
```

Un premier export sans limitation des workers a échoué avec une allocation mémoire Node. L’export avec un seul worker s’est terminé avec `Exported: dist`, bundle Hermes Android d’environ 4,7 Mo. Il s’agit d’un export JavaScript/ressources, pas d’un APK installé.

Chrome à 390 × 844 : quatre onglets, détail, poignée gestuelle, acceptation et reprise sur erreur, préparation et délai, confirmation prête, remise et QR, catalogue optimiste et formulaire, ventes, horaires, réglages conservés après rechargement/reconnexion, hors connexion et déconnexion. Les captures finales sont `screenshots-partenaire/apres-*.png`. Aucun backend réel n’est validé par ce scénario : les fixtures sont injectées uniquement dans le navigateur de test, jamais dans l’application.

Le lint a nécessité une exécution autorisée hors sandbox : le résolveur ESLint parcourait les dossiers parents et recevait `EPERM`. Les avertissements d’imports et de BOM repérés pendant le travail ont été corrigés. Les avertissements web sur `useNativeDriver` décrivent le repli de React Native Web vers JS ; aucune garantie de performances native n’en est déduite.

## Démo

Depuis la racine du dépôt, avec un backend déjà configuré et un compte partenaire actif :

```powershell
npm.cmd run web --prefix mobile/mobile-client -- --port 8092 --max-workers 1
```

Pour Expo Go sur le même réseau :

```powershell
npm.cmd run start --prefix mobile/mobile-client -- --max-workers 1
```

Le scénario frontend simulé est reproductible avec Chrome headless sur le port de débogage 9235 puis :

```powershell
node mobile/mobile-client/screenshots-partenaire/verifier.cjs apres
```

La commande de lancement Chrome et son dossier de profil dédié sont documentés dans l’en-tête du script. Les identifiants du script sont des fixtures, pas un compte de démonstration du backend.

## Limites et problèmes non corrigés

- Aucun téléphone réel, Expo Go réel, lecteur d’écran natif, clavier iOS/Android réel, mesure de 60 fps, essai au soleil, son ou haptique matériels, imprimante ou partage PDF système testés.
- Temps réel STOMP et authentification/autorisation contre le backend réel non testés. La pastille ne dit En direct que lorsque le contexte de connexion fourni par l’application le signale.
- Compte à rebours d’acceptation, ETA au commerce, plaque, photos et catégories de produit absents des contrats accessibles : aucun chiffre ni champ fictif ajouté.
- L’aperçu PDF/impression conserve son fonctionnement existant. Un dialogue ouvert ne prouve pas qu’un ticket a été imprimé.
- Après installation autorisée, npm signalait encore 37 vulnérabilités modérées ; aucune correction globale non demandée.
- Les actions réseau ne sont pas mises en file silencieusement : l’échec est affiché, la saisie est conservée et la disponibilité est restaurée. Les lectures sont réessayées au retour au premier plan et périodiquement.
- `backend/`, `web-responsable/`, `ia/`, l’app livreur et le reste de l’app client n’ont pas été modifiés. Les changements utilisateur préexistants de `backend/pom.xml` et les journaux JVM sont laissés intacts.

Pour la liste exacte des fichiers de chaque commit : `git show --stat <commit>` ou `git show --name-only <commit>`.
