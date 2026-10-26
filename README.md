# FleetPulse — Livraison

| Dossier | Contenu |
|---|---|
| `backend/` | Backend Spring Boot 4 / Java 25 / MySQL (port `8083`) |
| `mobile-client/` | Application client (Expo / React Native) : inscription, commandes, carte OpenStreetMap, paiement Stripe |
| `mobile-livreur/` | Application livreur (Expo / React Native) : connexion, véhicule affecté |
| `web-responsable/` | Application web du responsable (React + Vite) : connexion, commandes, livreurs, véhicules |
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

### Paiement par carte (Stripe, mode test)

Sans clés, le paiement par carte est désactivé (l'app propose seulement les espèces). Clés de test sur
https://dashboard.stripe.com/test/apikeys, puis dans PowerShell :

```powershell
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_PUBLISHABLE_KEY="pk_test_..."
./mvnw spring-boot:run
```

- Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque (`4000 0027 6000 3184` pour tester 3-D Secure).
- Devise : `tnd` par défaut (millimes). Si Stripe refuse la devise sur votre compte : `$env:STRIPE_CURRENCY="eur"`.
- Webhook (facultatif, l'app vérifie déjà le paiement) : `stripe listen --forward-to localhost:8083/api/stripe/webhook`,
  puis `$env:STRIPE_WEBHOOK_SECRET="whsec_..."`.
- Les clés ne doivent jamais être commitées.

### Comptes et authentification (sprint 1)

| Endpoint | Rôle |
|---|---|
| `POST /api/auth/login` | Email **ou téléphone** + mot de passe → `token` (JWT, profil dans l'en-tête) + `refreshToken` |
| `POST /api/auth/refresh`, `POST /api/auth/logout` | Rotation / révocation du jeton de rafraîchissement |
| `POST /api/auth/otp/demande`, `POST /api/auth/otp/inscription` | Inscription client par téléphone + code OTP |
| `POST /api/auth/inscription/partenaire`, `POST /api/auth/inscription/livreur` | Dossiers soumis à validation (`EN_ATTENTE`) |
| `POST /api/auth/mot-de-passe/oubli`, `POST /api/auth/mot-de-passe/reinitialiser` | Réinitialisation par code à 6 chiffres |
| `GET/PUT /api/dossier` | Le candidat suit et corrige son dossier |
| `/api/admin/dossiers/{id}/valider \| refuser \| complement` | Décision du Responsable (motif obligatoire pour refus / complément) |
| `/api/admin/comptes/{id}/suspendre \| reactiver` | Suspension / réactivation avec motif |
| `POST /api/admin/responsables` | Comptes Responsable `OPERATIONS` / `FINANCE` (administrateur principal uniquement) |
| `GET /api/admin/audit` | Journal d'audit (`?acteur=&action=&cibleId=&limite=`) |

Les codes OTP / réinitialisation sont **écrits dans les logs du serveur** (`JournalNotificationSender`) tant
qu'aucune passerelle SMS / email n'est branchée. Au premier démarrage, `MigrationComptes` convertit l'ancienne
colonne `utilisateur.actif` en `statut` (aucun script SQL à lancer).

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

## Lancer l'application web du responsable

```bash
cd web-responsable
npm install          # une seule fois
npm run dev          # http://localhost:5173
```

Connexion avec le compte responsable (`admin@fleetpulse.tn` / `admin12345`) ; les comptes client et livreur sont refusés.
Vite relaie `/api` vers `http://localhost:8083` (pas de CORS à configurer). Autre adresse : `API_URL=http://... npm run dev`.

Pages : **Commandes** (US-07, filtre par statut, recherche, détail), **Livreurs** (US-02 création/modification/activation,
choix du véhicule), **Véhicules** (US-03 création/modification/activation, affectation à un livreur).

## Vérifications

```bash
npm run typecheck                               # TypeScript (apps + shared)
npm run build --prefix web-responsable          # TypeScript + build de l'app web
npm run lint -w mobile-client -w mobile-livreur # ESLint
python scripts/e2e_mobile_api.py                # API (backend lancé)
```
