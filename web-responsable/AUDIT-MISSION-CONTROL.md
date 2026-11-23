# Audit initial et ordre de réalisation

Branche créée depuis `work-restyled` : `feat/mission-control`. Seul `web-responsable/` est modifié. La modification préexistante de `backend/pom.xml` et les journaux JVM à la racine sont laissés intacts.

## Vérifications initiales

- `npm.cmd install` : réussi, 31 paquets audités ; 4 vulnérabilités existantes (1 faible, 3 élevées).
- `npm.cmd run typecheck` : réussi (`tsc -b`).
- `npm.cmd run build` : réussi, 67 modules ; JS initial 414,52 ko, gzip 121,31 ko.
- PowerShell interdit `npm.ps1` : utiliser `npm.cmd` dans ce terminal.
- Audit npm : Vite 8.3.1 et sa chaîne PostCSS/source-map-js. Aucun changement de version hors périmètre appliqué.

## Architecture observée

`CarteVille3D.tsx` dessine une ville décorative en SVG et CSS avec perspective, sans données géographiques. `CarteDensite` et `CarteZones` chargent deux pages HTML locales utilisant Leaflet et les tuiles raster OSM ; les données transitent via `postMessage`.

`outils/simulation/simuler-suivi.mjs` se connecte aux comptes de démonstration, crée des commandes, les affecte, puis envoie des positions à `PUT /api/livreur/position`. Il suit OSRM si disponible, sinon un tracé urbain local. Le backend valide les points et émet des messages `/user/queue/positions` au client concerné. `GET /api/commandes/{id}/suivi` est réservé au propriétaire client, donc inutilisable avec une session responsable.

Pour le responsable, `GET /api/admin/dispatch` expose les dernières coordonnées des livreurs **disponibles**, leurs missions et les lots. `GET /api/livraisons` expose les destinations et `livreurPrenom`, sans identifiant du livreur. Aucun endpoint responsable de géométrie routière ni de dépôt physique n'a été trouvé. L'entrepôt est analytique, pas un dépôt géographique. Une association par prénom n'est utilisable que lorsque ce prénom est unique ; sinon elle reste indéterminée. ETA et distance calculées localement doivent être qualifiées d'estimations à vol d'oiseau. Les positions du simulateur existant seront visibles via la supervision.

**Correction de l'audit initial :** la lecture complémentaire de `EntrepotController`, `EntrepotDto` et `EntrepotService` a révélé `GET /api/admin/entrepot/export?depuis=…`, qui expose des traces GPS horodatées avec identifiant du coursier (limite 5 000 points). La relecture journalière a donc été ajoutée, avec filtre en heure de Tunis et curseur accessible. L'export ne permet pas de reconstruire automatiquement la géométrie routière ni tous les statuts historiques.

## Plan

1. Icônes distinctes, groupe Croissance et analyse, visibilité alignée sur les gardes (y compris Réclamations).
2. Suivi en direct chargé par React.lazy : MapLibre, OpenFreeMap vectoriel, bâtiments, interpolation, sélection et suivi caméra, alternatives 2D/texte, données réelles et démonstration explicite en repli. Relecture journalière ajoutée à l'étape 5 après découverte de l'export des traces GPS.
3. Réutiliser la carte sur Dispatch pour les arcs des lots ; origine paramétrable et identifiée car aucun dépôt n'est exposé. Sans deck.gl.
4. Entrée ≤ 200 ms, inclinaison limitée à Accueil, mouvement réduit, deux polices locales et licences.
5. Focus contrasté, contrôles nommés et états des pages ; vérification TypeScript/build, navigateur aux deux tailles, rapport des limites. Un commit par étape.

## Sources cartographiques

- https://openfreemap.org/quick_start/
- https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/

Source vectorielle publique sans clé : `https://tiles.openfreemap.org/planet`. Les coins arrondis des bâtiments ne sont pas simulés : extrusion standard MapLibre.
