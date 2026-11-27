# Simulateur de suivi en temps réel

Fait rouler une voiture de livraison dans Tunis et crée des commandes fictives, à travers la vraie API.
Réservé au mode démonstration : il utilise les comptes de démo créés par le backend (profil `demo`).

## Lancer

Démarrer d'abord le backend (http://localhost:8083), puis :

```bash
node outils/simulation/simuler-suivi.mjs
```

Le script :

1. connecte l'admin, le client, les 3 commerces et les 3 coursiers de démo ;
2. ajoute 4 adresses fictives au client (Habib Bourguiba, Rue de Marseille, Rue de Rome, Avenue de Paris) ;
3. passe des commandes fictives à des stades variés : en attente, acceptée, en préparation, prête, refusée, livrée ;
4. affecte une commande au **Coursier 1**, qui roule jusqu'au commerce, récupère le colis avec le vrai code de collecte, puis roule jusqu'au client ;
5. remet le colis avec le QR du client.

Chaque point est un vrai `PUT /api/livreur/position`, comme le téléphone du coursier. Le backend applique ses règles
habituelles : il écarte les points trop imprécis ou trop rapides, passe la commande « À proximité » à 300 m et
recalcule l'heure d'arrivée.

## Regarder la voiture

- **App client** (`mobile/mobile-client`, ex. `npx expo start --web --port 8092`) : se connecter avec
  `client@sprint6.demo` / `demo-sprint6-password`, ouvrir la commande en livraison. La carte suit le coursier.
- **Back-office** (http://localhost:5173, page Dispatch) : dernière position et missions du coursier.

## Options

| Option | Défaut | Effet |
|---|---|---|
| `--commandes N` | 6 | nombre de commandes fictives (0 = uniquement la voiture) |
| `--vitesse KMH` | 35 | vitesse de la voiture (plafonnée à 120) |
| `--intervalle S` | 2 | secondes entre deux positions |
| `--boucle` | non | enchaîne les livraisons sans fin (Ctrl+C pour arrêter) |
| `--sans-remise` | non | la voiture s'arrête devant le client, la commande reste en livraison |
| `--api URL` | http://localhost:8083 | adresse du backend |

L'itinéraire vient du serveur OSRM public (gratuit). S'il est injoignable, un tracé en rues à angles droits est
généré localement. Aucun service payant n'est utilisé.
# Livraison de quartier (Sprint 9)

`node outils/simulation/quartier.mjs` compare les trois modes sur les mêmes 60 demandes,
pour 10 %, 25 % et 40 % d'adhésion. Définir `API_TOKEN` (responsable opérations) et,
si nécessaire, `API_URL`. Le calcul ne crée aucune commande réelle.

`node outils/simulation/demo-quartier.mjs` crée trois commandes COD sur une **base démo**
préparée avec `APP_DEMO_ENABLED=true`, le profil `demo` et `SPRINT9_DONNEES_DEMO=true`.
Le script vérifie le mode démo, utilise seulement les comptes `@sprint9.demo`, marque
les colis prêts et accepte leur lot. Le parcours avec les trois remises est automatisé
dans `Sprint9QuartierParcoursTest`.
