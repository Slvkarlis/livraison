# FleetPulse — Livraison

| Dossier | Contenu |
|---|---|
| `backend/` | Backend Spring Boot 4 / Java 25 / MySQL (port `8083`) |
| `mobile/mobile-client/` | Application client (Expo / React Native) : inscription OTP, candidature partenaire, espace partenaire, commandes COD, carte OpenStreetMap |
| `mobile/mobile-livreur/` | Application livreur (Expo / React Native) : candidature, connexion, véhicule affecté |
| `web-responsable/` | Application web du responsable (React + Vite) : connexion, commandes, livreurs, véhicules |
| `mobile/packages/shared/` | Code partagé : types API, client HTTP avec refresh, session JWT, formulaires, libellés, composants UI |
| `scripts/e2e_mobile_api.py` | Vérification de bout en bout des appels API utilisés par les apps |

## Lancer le backend

Prérequis : **Java 25** dans `JAVA_HOME` et **MySQL 8+** (MySQL 5.7 n'est pas supporté : les verrous du Sprint 2
utilisent `SELECT … FOR UPDATE OF`). Le rapport [Sprint 1](docs/SPRINT1.md) décrit les écrans,
les contrats API, les vérifications et les limites.

MySQL 8 avec Docker (port `3307` pour ne pas gêner un MySQL local sur `3306`) :

```bash
docker run -d --name livraison-mysql -p 3307:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=livraison -v livraison-mysql-data:/var/lib/mysql --restart unless-stopped mysql:8.4
```

Puis, dans PowerShell (démo : données Sprint 2, codes OTP dans les logs, apercu web autorisé) :

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3307/livraison?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
$env:SPRING_DATASOURCE_USERNAME="root"; $env:SPRING_DATASOURCE_PASSWORD="root"
$env:SPRING_PROFILES_ACTIVE="demo"; $env:APP_DEMO_ENABLED="true"; $env:SPRINT2_DONNEES_DEMO="true"
$env:CORS_ORIGINES="http://localhost:8081,http://localhost:8082"
cd backend
./mvnw spring-boot:run
```

Compte responsable créé au démarrage : `admin@fleetpulse.tn` / `admin12345`.

Le [rapport Sprint 2](docs/SPRINT2.md) décrit le catalogue, les zones, les adresses, le panier et les commandes COD,
les endpoints, la migration et les vérifications. Les frais viennent de la zone de l’adresse ; une adresse
sans couverture est refusée. Le paiement se fait **uniquement à la livraison (COD)**.

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

Les codes OTP / réinitialisation sont **écrits dans les logs du serveur** uniquement avec
`APP_DEMO_ENABLED=true` et le profil `dev` ou `demo` (`SPRING_PROFILES_ACTIVE=demo`). Le bandeau
« Mode démonstration » apparaît alors dans les interfaces. Hors démo, une passerelle SMS/email réelle est
nécessaire ; les envois non configurés répondent 503. Au premier démarrage, `MigrationComptes` convertit l'ancienne
colonne `utilisateur.actif` en `statut` (aucun script SQL à lancer).

## Lancer les applications mobiles

Prérequis : Node 20.19+, l'application **Expo Go** sur le téléphone, téléphone et PC sur le même Wi-Fi.

```bash
cd mobile
npm install          # une seule fois, dans mobile/ (npm workspaces)
npm run client       # application client
npm run livreur      # application livreur (dans un autre terminal, Expo proposera un autre port)
```

Scannez le QR code avec Expo Go. Les apps appellent automatiquement le backend sur
`http://<IP du PC>:8083` (même IP que le serveur Expo). Pour une autre adresse :

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8083 npm run client
```

Si le téléphone n'arrive pas à joindre le backend, autorisez le port 8083 dans le pare-feu Windows.

**Aperçu dans le navigateur** (Expo web, backend lancé avec `CORS_ORIGINES`) :

```bash
npm run web --prefix mobile/mobile-client -- --port 8081
```

En web, la session reste en mémoire : recharger la page déconnecte. La carte utilise une iframe
(`CarteLeaflet.web.tsx`) à la place de la WebView.

Les coursiers peuvent déposer une candidature depuis leur app et suivre sa validation. Le responsable peut
toujours créer un livreur avec le CRUD existant. Les clients s'inscrivent par OTP depuis leur app ;
« Devenir partenaire » ouvre la candidature commerciale.

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
Le Sprint 1 ajoute **Dossiers**, **Comptes**, **Journal d’audit** et **Mot de passe oublié**.
Le sous-rôle FINANCE accède au journal ; OPERATIONS et l’administrateur principal accèdent à la gestion.

## Vérifications

```bash
npm run typecheck --prefix mobile               # TypeScript (apps + shared)
npm run build --prefix web-responsable          # TypeScript + build de l'app web
npm run lint --prefix mobile                    # ESLint (apps + shared)
node --test scripts/sprint1.test.cjs             # refresh, guards et validations
python scripts/e2e_mobile_api.py                # API (backend lancé)
```
