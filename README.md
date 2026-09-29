# FleetPulse — Livraison

| Dossier | Contenu |
|---|---|
| `src/`, `pom.xml` | Backend Spring Boot 4 / Java 17 / MySQL (port `8083`) |
| `mobile-client/` | Application client (Expo / React Native) : inscription, connexion, commandes |
| `mobile-livreur/` | Application livreur (Expo / React Native) : connexion, véhicule affecté |
| `packages/shared/` | Code partagé : types API, client HTTP, session JWT, libellés, composants UI |
| `scripts/e2e_mobile_api.py` | Vérification de bout en bout des appels API utilisés par les apps |

## Lancer le backend

```bash
./mvnw spring-boot:run
```

Compte responsable créé au démarrage : `admin@fleetpulse.tn` / `admin12345`.

Les frais de livraison sont calculés par le serveur (distance dépôt → adresse, rémunération livreur + carburant,
marge bénéficiaire, supplément pour une livraison immédiate). Paramètres : `app.depot.*` et `app.tarification.*`
dans `application.properties`.

## Lancer les applications mobiles

Prérequis : Node 20.19+, l'application **Expo Go** sur le téléphone, téléphone et PC sur le même Wi-Fi.

```bash
npm install          # une seule fois, à la racine (npm workspaces)
npm run client       # application client
npm run livreur      # application livreur (dans un autre terminal, Expo proposera un autre port)
```

Scannez le QR code avec Expo Go. Les apps appellent automatiquement le backend sur
`http://<IP du PC>:8083` (même IP que le serveur Expo). Pour une autre adresse :

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8083 npm run client
```

Si le téléphone n'arrive pas à joindre le backend, autorisez le port 8083 dans le pare-feu Windows.

Les comptes livreurs sont créés par le responsable (`POST /api/admin/livreurs`) ; les clients s'inscrivent depuis l'app.

## Vérifications

```bash
npm run typecheck                               # TypeScript (apps + shared)
npm run lint -w mobile-client -w mobile-livreur # ESLint
python scripts/e2e_mobile_api.py                # API (backend lancé)
```
