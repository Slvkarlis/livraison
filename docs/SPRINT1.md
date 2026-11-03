# Sprint 1 — interfaces et vérifications

Les interfaces réutilisent React/Vite pour le responsable et Expo 57 / React Native pour les applications client et coursier. Les composants, contrats, validations et règles d’accès mobiles sont dans `mobile/packages/shared/src/`. Le transport HTTP et les règles sans dépendance native sont également utilisés par le web. Aucune bibliothèque d’interface supplémentaire n’a été ajoutée. H2 est une dépendance de **test uniquement**, pour vérifier les parcours HTTP sans modifier la base MySQL de développement.

## Écrans livrés

| User story | Écrans et comportement | Fichiers principaux |
|---|---|---|
| US-101 | Inscription client par téléphone international, code SMS, renvoi différé, validation d’identité et création de session | `mobile/mobile-client/src/app/inscription.tsx`, `mobile/packages/shared/src/parcours.tsx` |
| US-102 | Connexion email/téléphone, refresh unique en cours, rotation persistée, rejeu après 401 et déconnexion avec révocation serveur | `mobile/packages/shared/src/http.ts`, `auth.tsx`, `web-responsable/src/api.ts`, `session.tsx` |
| US-103 | Routes et menus selon le rôle, sous-rôles OPERATIONS/FINANCE, accès refusé sur web, suivi seul pour les candidats, message explicite pour les comptes suspendus | `mobile/*/src/app/_layout.tsx`, `mobile/packages/shared/src/sprint1.ts`, `web-responsable/src/App.tsx`, `composants/Layout.tsx` |
| US-104 | Candidature partenaire : identité, commerce, catégorie, adresse, coordonnées et matricule fiscal ; suivi et correction du complément | `mobile/mobile-client/src/app/candidature.tsx`, `dossier.tsx`, `mobile/packages/shared/src/parcours.tsx` |
| US-105 | Dossiers partenaires/coursiers, recherche et filtres, détail, validation/refus/complément avec confirmation et motif obligatoire | `web-responsable/src/pages/Comptes.tsx` sur `/dossiers` |
| US-106 | Candidature coursier : identité, numéro de pièce et véhicule déclaré ; suivi et correction du complément | `mobile/mobile-livreur/src/app/candidature.tsx`, `dossier.tsx`, composants partagés |
| US-107 | Demande de code, nouveau mot de passe avec minimum de 8 caractères et confirmation, renvoi différé, succès | `mobile/*/src/app/mot-de-passe-oublie.tsx`, `web-responsable/src/pages/MotDePasseOublie.tsx` |
| US-108 | Journal paginé, filtres acteur/action/dates, détail d’une entrée ; accessible aussi au sous-rôle FINANCE | `web-responsable/src/pages/Audit.tsx`, `Service/AuditService.java` |
| US-109 | Comptes filtrables par rôle/statut et recherche ; suspension/réactivation avec confirmation et motif | `web-responsable/src/pages/Comptes.tsx` sur `/comptes` |

Les listes et formulaires affichent leurs états de chargement, d’erreur et de succès ; les listes affichent aussi l’état vide. Les modales retiennent le focus au clavier et le rendent au bouton d’origine à la fermeture. Le back-office reste utilisable sur une largeur de 390 px, avec défilement horizontal des grands tableaux.

## Contrats API utilisés

Les chemins ci-dessous sont relatifs à `/api`. Les mutations utilisent du JSON. `identité` désigne `{nom, prenom, email, telephone, motDePasse}` ; le champ `email` de la connexion accepte aussi un téléphone. Le mot de passe doit avoir au moins 8 caractères. Les formulaires demandent un téléphone international, par exemple `+21620123456`.

| Méthode / chemin | Corps ou paramètres | Réponse / autorisation |
|---|---|---|
| `GET /auth/config` **ajouté** | Aucun | 200 `{demonstration, delaiRenvoiSecondes}` ; public |
| `POST /auth/otp/demande` | `{telephone}` | 202 ; public ; 429 si renvoi trop tôt |
| `POST /auth/otp/inscription` | identité + `{code}` | 201 avec jetons ; public ; email également obligatoire dans l’API existante |
| `POST /auth/login` | `{email, motDePasse}` | 200 `{token, type, expiresInMs, refreshToken, refreshExpiresInMs}` ; 401 identifiants incorrects, 403 compte suspendu |
| `POST /auth/refresh` | `{refreshToken}` | 200 avec paire de jetons renouvelée ; 401 invalide/expiré/révoqué, 403 suspendu |
| `POST /auth/logout` | `{refreshToken}` | 204 ; révoque ce refresh token |
| `GET /me` | Bearer JWT | 200 profil avec rôle, statut et sous-rôle |
| `POST /auth/mot-de-passe/oubli` | `{identifiant}` | 202 identique pour un compte existant ou inconnu lorsque l’envoi est configuré |
| `POST /auth/mot-de-passe/reinitialiser` | `{identifiant, code, nouveauMotDePasse}` | 204 ; 400 code ou mot de passe invalide ; révoque les refresh tokens existants |
| `POST /auth/inscription/partenaire` | identité + `{nomCommerce, categorie, adresse, latitude, longitude, matriculeFiscal}` | 201 dossier `EN_ATTENTE` ; public |
| `POST /auth/inscription/livreur` | identité + `{numeroIdentite, vehiculeDeclare}` | 201 dossier `EN_ATTENTE` ; public |
| `GET /dossier` | Bearer JWT | 200 dossier du titulaire |
| `PUT /dossier` | Champs d’identité/dossier corrigés ; sans email ni mot de passe | 200 dossier remis `EN_ATTENTE` ; rôle CANDIDAT et dossier encore ouvert |
| `GET /admin/comptes` et `GET /admin/comptes/{id}` | Filtres optionnels `role`, `statut` pour la liste | 200 comptes/dossier ; OPERATIONS ou administrateur principal |
| `GET /admin/dossiers` | Aucun | 200 dossiers ouverts ; OPERATIONS ou administrateur principal. L’interface utilise `/admin/comptes` pour inclure aussi les dossiers traités. |
| `PUT /admin/dossiers/{id}/valider` | Aucun | 200 compte actif ; OPERATIONS ou administrateur principal |
| `PUT /admin/dossiers/{id}/refuser` ou `/complement` | `{motif}` non vide, maximum 500 caractères | 200 dossier ; mêmes droits |
| `PUT /admin/comptes/{id}/suspendre` ou `/reactiver` | `{motif}` non vide, maximum 500 caractères | 200 compte ; OPERATIONS ou administrateur principal ; seul le principal peut modifier un responsable ; auto-suspension interdite |
| `GET /admin/audit/page` **ajouté** | `acteur` exact, `action`, `debut`, `fin` ISO, `page` dès 0, `taille` de 1 à 100 | 200 `{content, number, totalPages, totalElements}` ; tous les responsables actifs |
| `GET /admin/audit` | Ancien contrat `acteur`, `action`, `cibleId`, `limite` | Conservé pour compatibilité |
| `POST /admin/responsables` | identité + `{sousRole: "OPERATIONS" ou "FINANCE"}` | 201 ; administrateur principal uniquement ; création disponible par API |

L’audit utilise une borne de début incluse et une borne de fin exclue. L’interface convertit la date « Au » en début du lendemain dans le fuseau du navigateur, puis transmet des instants ISO.

Erreurs métier : JSON `{code, message}` avec 400 `DONNEES_INVALIDES`, 401 `AUTHENTIFICATION_ECHOUEE`, 403 `ACCES_REFUSE` ou `COMPTE_INACTIF`, 404 `INTROUVABLE`, 409 `DEJA_UTILISE` ou `ETAT_INVALIDE`, 429 `TROP_DE_DEMANDES`. Une requête sans JWT valide peut recevoir un 401 sans corps. L’interface prévoit ce cas. Les erreurs de filtre/date sont maintenant des 400. Sans passerelle SMS/email et hors démo autorisée, les opérations nécessitant un envoi répondent 503 `SERVICE_INDISPONIBLE`.

## Ajustements backend et sécurité

- Ajout de la configuration publique de démonstration et de la pagination/filtres de dates côté serveur pour l’audit. L’ancien endpoint d’audit reste disponible.
- Un dossier `REFUSE` peut se connecter avec le seul rôle technique CANDIDAT pour lire son motif. Les fonctions métier de son rôle restent interdites et la correction d’un dossier refusé reste refusée. Un compte `SUSPENDU` ne peut pas se connecter.
- Les codes ne sont journalisés que si `APP_DEMO_ENABLED=true` **et** le profil `dev` ou `demo` est actif. La présence de `prod` ou `production` désactive ce comportement. Un bandeau visible utilise la valeur fournie par le serveur.
- Les DTO contenant mots de passe, codes ou jetons masquent leur représentation `toString()`, y compris dans les traces de diagnostic Spring.
- Sur mobile natif, la paire de jetons est conservée dans Expo SecureStore. Sur web, les jetons restent en mémoire et disparaissent à la fermeture/recharge de la page. L’ancien stockage web dans localStorage est supprimé.
- Les écritures de session sont sérialisées. Une déconnexion pendant un refresh empêche une restauration tardive et révoque le nouveau refresh token éventuel. Un échec de révocation réseau ferme la session locale et affiche l’échec au lieu d’annoncer une révocation serveur réussie.

## Résultats vérifiés

| Vérification | Résultat |
|---|---|
| `mvn test` avec Java 25 | **36 tests réussis**, dont 3 scénarios HTTP complets et 2 tests de confidentialité/mode démo |
| `node --test scripts/sprint1.test.cjs` | **20 tests réussis** : refresh concurrent, réponse 401 tardive, échecs, logout pendant refresh, guards, OTP, motifs et candidatures |
| Build web et TypeScript des deux apps + shared | Réussis |
| ESLint mobile et composants partagés | Réussi ; aucun linter web distinct n’est configuré dans le dépôt |
| Export des bundles Android client et coursier | Réussi pour les deux apps |
| Chrome avec backend H2 réel | 9 contrôles réussis : guard anonyme/démo, mauvais login, demande de reset, refus/motif/focus, suspension/réactivation, audit, largeur 390 px, droits FINANCE, absence d’exception JavaScript |
| Affichage natif Android/iOS | Non vérifié : aucun appareil ou émulateur connecté à ADB |

Les tests HTTP couvrent l’inscription OTP et sa limitation de renvoi, la connexion par téléphone, refresh/logout, le reset de mot de passe, puis les candidatures partenaire **et** coursier : attente → complément → correction → validation → accès limité au rôle → suspension → connexion refusée → réactivation. Ils couvrent aussi le refus avec motif consultable, les interdictions côté serveur et les filtres/pagination de l’audit.

Pour reproduire depuis la racine, avec les dépendances déjà installées et Java 25 dans `JAVA_HOME` :

```powershell
node --test scripts/sprint1.test.cjs
npm.cmd run typecheck --prefix mobile
npm.cmd run lint --prefix mobile
npm.cmd run build --prefix web-responsable
Set-Location backend
mvn.cmd --batch-mode --no-transfer-progress test dependency:build-classpath '-Dmdep.outputFile=../.tmp/backend-classpath.txt'
Set-Location ..
node scripts/verify-sprint1-browser.cjs
```

Le script navigateur exige Chrome ou Edge sous Windows. Il démarre une base H2 en mémoire sur le port 18083 et un serveur web sur le port 15173, crée ses propres comptes, puis ferme les processus qu’il a lancés. Il ne modifie pas MySQL. Ses résultats et sa capture à 390 px sont dans `.tmp/`, ignoré par Git. Les ports doivent être libres.

## Lancer la démonstration

Prérequis : Java 25, Node compatible avec les versions installées, MySQL avec la base de développement configurée. Dans PowerShell, à la racine :

```powershell
$env:SPRING_PROFILES_ACTIVE = 'demo'
$env:APP_DEMO_ENABLED = 'true'
Set-Location backend
.\mvnw.cmd spring-boot:run
```

Dans deux autres terminaux à la racine :

```powershell
npm.cmd run dev --prefix web-responsable
npm.cmd run client --prefix mobile
# Ou, dans un autre terminal :
npm.cmd run livreur --prefix mobile
```

Le responsable de développement est `admin@fleetpulse.tn` / `admin12345`, créé seulement s’il n’existe pas, ou les valeurs de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Un compte existant n’est pas réinitialisé au démarrage. Les comptes client/partenaire/coursier se créent depuis les formulaires. Le serveur écrit les codes en mode démo dans ses propres logs. Sur téléphone, définir si nécessaire `EXPO_PUBLIC_API_URL=http://<IP-PC>:8083` et utiliser le même réseau que le PC. Pour un autre backend web, définir `API_URL` avant le lancement Vite.

Les tests H2 utilisent un administrateur distinct : `admin@sprint1.test` / `test-admin-password`. Ces identifiants ne concernent pas la base MySQL normale.

## Limites et écarts explicites

- L’API existante crée les candidatures comme des comptes distincts. Elle ne convertit pas un compte client inscrit par OTP en partenaire/coursier : utiliser des emails et téléphones distincts pour la démonstration de ces branches.
- Le backend attend des informations de pièces (matricule fiscal, numéro d’identité, véhicule déclaré), pas des fichiers ; aucun upload de document n’a été inventé.
- La robustesse du mot de passe reprend la règle backend de 8 caractères minimum. Aucun nouveau critère de complexité côté serveur n’est ajouté.
- Après validation, le partenaire reste sur son écran de statut ; son espace commercial relève des sprints suivants. Le client et le coursier actifs retrouvent leurs espaces existants.
- Aucune passerelle SMS/SMTP de production n’est intégrée. Hors démo, il faut fournir une implémentation réelle de `NotificationSender` pour les opérations avec notification.
- Les interactions natives, le clavier et l’affichage sur appareil restent à valider. Les tests OTP côté interface portent sur les validations partagées ; le parcours OTP réel est vérifié au niveau HTTP.
- Le paiement Stripe, les fonctions COD, les commandes, la tarification et les implémentations du CRUD livreurs/véhicules sont conservés. Seule la représentation de leur DTO de création contenant un mot de passe est masquée pour les logs.
