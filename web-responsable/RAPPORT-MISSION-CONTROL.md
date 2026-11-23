# FleetPulse — Rapport de réalisation

Branche : `feat/mission-control`, créée depuis `work-restyled`. Toutes les modifications réalisées sont dans `web-responsable/`. Le changement préexistant de `backend/pom.xml` et les journaux JVM à la racine ne font pas partie de ces commits.

## Commits

| Commit | Résultat et fichiers | Dépendances | Écarts et limites |
|---|---|---|---|
| `6cad290` | Audit initial et ordre de réalisation, `AUDIT-MISSION-CONTROL.md` | Aucune | L'export des traces GPS, manqué à la première lecture, est documenté dans la correction de l'audit. |
| `5aab707` | Icônes distinctes, groupe Croissance et analyse, droits Réclamations corrigés. `src/composants/Layout.tsx` | Aucune | Les 20 liens existants sont conservés ; le brief en annonçait 19. |
| `bdd1278` | Suivi 3D, bâtiments réels, sélection clavier, caméra Suivi/Libre, interpolation, destination pulsée, carte 2D et repli schématique. `src/App.tsx`, `src/composants/{Layout,CarteMission}.tsx`, `src/pages/SuiviLive.tsx`, `src/{suivi,types}.ts`, `src/styles.css`, `package*.json`, script et captures navigateur | `maplibre-gl` 6.19.0 uniquement | Tracé avant le coursier = direction estimée ; trace arrière = observations de cet onglet. Coins arrondis des bâtiments non ajoutés. Pas de modification des contrats serveur. |
| `f05fada` | Carte des lots chargée à la demande, arcs GeoJSON et légende textuelle, coordonnées du dépôt modifiables. `src/pages/Dispatch.tsx`, `src/composants/CarteLots.tsx`, `src/styles.css` | Aucune | Aucun dépôt physique exposé : centre de Tunis indiqué comme origine par défaut. Palette de cinq nuances ambre/neutres, réutilisées au-delà de cinq lots ; les identifiants restent dans la légende. Pas de deck.gl : MapLibre suffit. |
| `691dc14` | Entrée 180 ms sans cascade, inclinaison limitée aux tuiles d'Accueil, mouvement réduit, polices locales et licences. `index.html`, `src/styles.css`, `src/composants/{Layout,CarteMission}.tsx`, `public/fonts/*`, `scripts/telecharger-polices.mjs` | Aucune | Polices variables TTF locales ; aucun appel Google Fonts au rendu. |
| Étape 5 — commit `feat(web): improve accessibility states and recorded GPS replay` | Focus contrasté, champs nommés, erreurs annoncées, protection contre les réponses tardives et les écrans blancs, curseur de relecture GPS. `src/{App,api,suivi}.ts*`, `src/composants/{Layout,ui,CarteMission,FrontierePage,RelectureSuivi}.tsx`, `src/pages/{Accueil,BiFinance,BiOperations,Finance,Livreurs,Vehicules,SuiviLive}.tsx`, `src/styles.css`, scripts, captures et rapports | Aucune | Relecture limitée aux 5 000 points exportés par le serveur ; pas de reconstruction des statuts historiques. |

La liste exacte de chaque commit se consulte avec `git show --stat <commit>`.

## Fonctionnement et sources

Le suivi utilise les endpoints existants : `/api/admin/dispatch` et `/api/livraisons`, lus toutes les trois secondes lorsque l'onglet est visible. Les marqueurs interpolent la dernière observation vers la suivante sur deux secondes. La supervision expose uniquement les coursiers disponibles ayant une position connue ; elle n'est pas un inventaire de toute la flotte.

Les commandes ne fournissent pas l'identifiant du livreur : une association est affichée uniquement si son prénom est unique dans les coursiers exposés. En cas de plusieurs missions, la carte montre la première commande active par identifiant, sans prétendre connaître l'ordre optimal. ETA locale à 20 km/h et distance à vol d'oiseau sont explicitement indiquées. Le suivi client et son WebSocket restent inchangés.

« Voir la démonstration » fournit un scénario local déterministe, signalé comme fictif, utilisant les coordonnées du simulateur existant. Il n'écrit aucune commande ni position sur le serveur. Le simulateur réel existant envoie ses positions au backend et peut alimenter la supervision sans adaptation.

La relecture appelle `/api/admin/entrepot/export?depuis=…` et `/api/admin/livreurs`, filtre la journée en heure de Tunis, regroupe les points par identifiant et interpole entre les mesures. Le curseur est un contrôle natif accessible au clavier. Il n'apparaît qu'après réception de points ; un état vide explique leur absence.

Fond vectoriel public sans clé : [OpenFreeMap](https://openfreemap.org/quick_start/), avec [extrusions MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/). Le worker est empaqueté séparément selon [la documentation Vite de MapLibre](https://maplibre.org/maplibre-gl-js/docs/). Repli raster CARTO si le vecteur échoue ; sans WebGL, vue schématique SVG et liste textuelle. Une cadence inférieure à 22 images/s sur deux fenêtres de cinq secondes déclenche la vue 2D.

## Accessibilité et états

Contrastes calculés en sRGB : focus brun/blanc **7,27:1**, focus/fond chaud **6,09:1**, texte secondaire/fond chaud **5,30:1**, texte secondaire/graphite **5,87:1**, focus ambre/graphite **8,40:1**.

Pages modifiées : **Suivi en direct, Dispatch, Accueil, BI Finance, BI Opérations, Finance, Livreurs, Véhicules**. Le composant partagé `EtatTableau` annonce les erreurs et `useDonnees` ignore les réponses devenues obsolètes. Les autres pages conservent leurs états existants. `FrontierePage` fournit une erreur lisible si un rendu ou un module différé échoue. Les sélecteurs d'affectation dans Livreurs et Véhicules ont maintenant un nom accessible. La navigation conserve le lien actif visible lors d'un redimensionnement.

## Vérifications

Les résultats détaillés sont conservés dans `screenshots/rapport-navigateur.json`, les captures dans `screenshots/suivi-live-1366.png` et `screenshots/suivi-live-390.png`.

- Audit initial : `npm.cmd install`, `npm.cmd run typecheck`, `npm.cmd run build` réussis. Quatre vulnérabilités préexistantes restent signalées à l'audit final (Vite et sa chaîne de dépendances) ; pas de migration d'outillage ajoutée à cette tâche.
- Vérifications de données : `node --experimental-strip-types scripts/verifier-donnees.mjs` (Node 22). Coordonnées invalides, symétrie des distances, interpolation, extrémités des arcs, homonymes, commandes terminées et mouvement du scénario testés.
- Chrome headless installé utilisé via CDP natif, sans dépendance Playwright/Puppeteer. Les tests interceptent les API **uniquement dans le navigateur de vérification**, avec des réponses contrôlées. Aucun contournement d'authentification n'est inclus dans le produit.
- Parcours authentifiés `/suivi-live`, `/accueil`, `/dispatch`, `/commandes`, sélection d'un autre coursier, modes Suivi/Libre et 2D/3D, rôles Finance/Opérations, relecture, absence de WebGL et chargement des deux polices testés. L'absence d'appels Google Fonts est contrôlée.
- Vérification étendue : **38 scénarios** vide/erreur sur **19 pages**, sans champ anonyme détecté dans leurs vues principales. Repli raster confirmé en bloquant le fournisseur vectoriel. **Aucune erreur JavaScript ni avertissement console** dans le rapport final. Les interruptions réseau `ERR_ABORTED` correspondent aux navigations/démontages et à l'essai de coupure volontaire ; elles restent visibles dans le rapport.
- Le Simulateur de lots conserve ses états initiaux, d'envoi et d'erreur existants, contrôlés par lecture du code ; son calcul serveur n'a pas été exécuté. Les formulaires secondaires de toutes les pages n'ont pas fait l'objet d'une matrice exhaustive de tests.
- Les sorties finales TypeScript/build sont dans `screenshots/verification-typecheck.txt` et `screenshots/verification-build.txt`.

## Limites de vérification et problèmes conservés

- Le backend ne répondait pas sur `http://localhost:8083`. Connexion réelle, renouvellement JWT, données GPS du simulateur et relecture réelle **non vérifiés de bout en bout**. Les tests navigateur utilisent les réponses API contrôlées décrites ci-dessus.
- Le simulateur existant n'a pas été lancé : il crée et modifie des données backend, et le serveur était indisponible. Son code a été lu ; sa sortie est consommée par les endpoints de supervision existants.
- Pas d'essai sur téléphone physique, autre navigateur, lecteur d'écran réel ou flotte importante. Le déclenchement du repli pour faible cadence n'est pas une mesure sur appareil réel.
- MapLibre représente environ 1,08 Mo de JS minifié, plus un worker de 550 ko. Vite conserve son avertissement de chunk > 500 ko ; ces ressources sont chargées à la demande, sur Suivi ou à l'ouverture de la carte des lots. Le bundle initial reste proche de l'origine (environ 417 ko contre 414,5 ko).
- La couverture des bâtiments et leur hauteur dépendent des données OSM. Une connexion aux serveurs de tuiles reste nécessaire au fond géographique.
- Les anciennes cartes Leaflet de Zones/BI chargent encore Leaflet depuis jsDelivr ; leur architecture n'a pas été remplacée.

## Lancer la démonstration

Depuis la racine du dépôt, dans PowerShell :

```powershell
cd web-responsable
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Le proxy `/api` reste dirigé vers `http://localhost:8083`, sans changement de configuration. Pour le backend de démonstration, avec Java 25 et le MySQL 8 de `../README.md` déjà démarré sur le port 3307, ouvrir un autre PowerShell à la racine du dépôt :

```powershell
$env:SPRING_DATASOURCE_URL = 'jdbc:mysql://localhost:3307/livraison?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true'
$env:SPRING_DATASOURCE_USERNAME = 'root'
$env:SPRING_DATASOURCE_PASSWORD = 'root'
$env:SPRING_PROFILES_ACTIVE = 'demo'
$env:APP_DEMO_ENABLED = 'true'
$env:SPRINT2_DONNEES_DEMO = 'true'
$env:SPRINT6_DONNEES_DEMO = 'true'
cd backend
.\mvnw.cmd spring-boot:run
```

Les identifiants MySQL ci-dessus sont ceux du conteneur local de démonstration documenté par le dépôt ; adaptez-les à votre installation. Cette commande backend n'a pas été exécutée pendant ce travail. Se connecter sur `http://localhost:5173/connexion` avec `admin@fleetpulse.tn` / `admin12345`, ouvrir **Opérations → Suivi en direct**, puis **Voir la démonstration** si la flotte n'a pas de positions.

Pour alimenter les vraies données, après démarrage du backend de démonstration et de ses comptes Sprint 6, depuis la racine du dépôt dans un second terminal :

```powershell
node outils/simulation/simuler-suivi.mjs --commandes 0 --sans-remise
```

Le simulateur nécessite les comptes et données Sprint 6 (`SPRINT6_DONNEES_DEMO=true`) décrits dans les rapports du dépôt. Il ne remplace pas le démarrage du serveur ni de MySQL. Le profil démo expose les codes OTP dans les journaux.

Pour refaire les captures, démarrer Chrome headless avec le port de débogage 9229 et un profil temporaire distinct, puis exécuter depuis `web-responsable/` :

```powershell
node scripts/verifier-navigateur.mjs
```
