# Audit B2B — 24 novembre 2026

Branche de départ : `feat/mission-control`. Travail limité à `web-responsable/`.

## État initial exécuté

- `npm.cmd install` : succès, 4 vulnérabilités (1 faible, 3 élevées), existantes ; `npm.cmd audit --json` ne propose pas de correction automatique.
- `npm.cmd run typecheck` : succès, aucune erreur.
- `npm.cmd run build` : succès ; avertissement existant pour le module MapLibre de 1 080,50 kB.
- `npm` ne peut pas appeler `npm.ps1` avec la politique PowerShell actuelle : utiliser `npm.cmd`.
- Serveur Vite lancé sur 5174 (5173 déjà occupé). Chrome headless via CDP, sans ajout de dépendance de test.
- Captures initiales : `screenshots/avant-{accueil,commandes,dispatch,suivi-live}.png`. API simulée uniquement par le navigateur. Aucune exception ou erreur console lors de cette capture.

## Lecture critique

Sources lues : styles.css, ui.tsx, luxe.tsx, Layout.tsx, statuts.ts, BiCommun.tsx, App.tsx, API, et pages Accueil, Commandes, Dispatch, Finance, Livreurs, Connexion, MotDePasseOublie.

1. **Accueil** (`avant-accueil.png`) : cartes très hautes, données essentielles sous la ligne de flottaison à 1366 × 768, ambre décoratif, indicateur principal sur une scène sans rapport avec sa valeur. La mini-courbe de luxe.tsx invente une tendance lorsqu'aucune série n'est fournie ; les compteurs animés affichent temporairement des valeurs incorrectes.
2. **Commandes** (`avant-commandes.png`) : le détail permanent et sa ville décorative prennent presque la moitié de la largeur ; liste sans pagination, tri ni filtres zone/date. Beaucoup d'arrondis concurrencent la hiérarchie des informations.
3. **Dispatch** (`avant-dispatch.png`) : empilement vertical de trois tableaux, rapprochement commande/livreur difficile. Les succès sont affichés avec l'alerte rouge ; il manque un retour de confirmation distinct.
4. **Suivi direct** (`avant-suivi-live.png`) : référence de non-régression, logique et rendu des cartes à conserver. Seul le cadre commun sera harmonisé.

Composants : StatHero/StatTuile/Indicateur doublonnent les indicateurs ; Puce et boutons ont plusieurs implémentations. CSS accumulé, sélecteurs BI et titres redéfinis en fin de fichier. Animations d'entrée et inclinaison pilotées à la fois en CSS et dans Layout. Couleurs de statut codées en hexadécimal dans plusieurs pages.

États : les listes ont généralement EtatTableau, mais les cartes de statistiques peuvent présenter des zéros pendant un échec. Finance/commissions et certains panneaux secondaires n'ont pas d'état d'erreur propre. L'historique d'intervention n'a pas de bouton Réessayer. Pas de système commun pour les confirmations.

Accessibilité : labels déjà présents dans de nombreux formulaires et focus partiellement géré dans Modale ; absence de mode sombre, de lien d'évitement, de tableau navigable au clavier et de palette de commandes. Les captures seules ne prouvent ni les contrastes AA ni le comportement du focus : tests complémentaires nécessaires.

## Ordre d'exécution

0. Enregistrer cet audit et l'état initial.
1. Finir les fondations : tokens clair/sombre, composants typés, gestion du focus, DataTable, suppression des animations et styles devenus inutiles hors cartes.
2. Coquille : navigation par rôle repliable, palette Ctrl/Cmd+K, recherche de commande, fil d'Ariane, thème persistant, menu utilisateur, chargement différé.
3. Finir Accueil, Commandes et Dispatch avec leurs états et interactions réelles via les API existantes.
4. Harmoniser Finance/BI et authentification si possible ; documenter précisément les migrations restantes.
5. Exécuter typecheck/build, tests navigateur (réponses simulées explicitement identifiées), captures clair/sombre bureau/mobile, non-régression du suivi. Distinguer cela de l'intégration au backend réel.

Pas de nouvelle bibliothèque de graphiques : SVG suffisant. Seule nouvelle dépendance prévue : lucide-react, autorisée dans la demande.
