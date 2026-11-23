# Handoff IA : entraînement dans Colab

Ce dossier permet d'entraîner les trois modèles du service d'IA sans machine d'entraînement
dédiée. Tout se fait dans Google Colab, gratuit, avec le notebook `FleetPulse_IA_Colab.ipynb`.

## Ce qu'il vous faut

1. **`ia.zip`** : le dossier `ia/` du dépôt compressé, avec `ia/` comme racine de l'archive.
2. **`export.json`** : un seul fichier contenant trois jeux (voir `CONTRATS.md`) :
   ```json
   { "eta": [...], "demande": [...], "prospection": [...] }
   ```
   Il est produit par un seul appel au responsable (jeton OPERATIONS) :
   `GET /api/admin/entrepot/export-ia` → `{eta, demande, prospection}`.
   Enregistrer la réponse sous `export.json`.

## Lancer dans Colab

1. Ouvrir `FleetPulse_IA_Colab.ipynb` dans Colab (Fichier → Importer un notebook).
2. Exécuter les cellules dans l'ordre. Elles demandent `ia.zip` puis `export.json`.
3. La cellule 6 affiche les métriques ; la cellule 7 trace la prévision contre le réel.
4. La cellule 8 télécharge `fleetpulse_modeles.zip`.

Sans export réel, la cellule 5 peut tourner sur un historique simulé :
`!python entrainer.py --simule --tout --dossier /content/sortie` (utile pour vérifier la chaîne).

## Ce qu'il faut me renvoyer

Pour que je puisse intégrer les modèles et continuer le développement :

- `fleetpulse_modeles.zip` (les trois `modele_*.pkl` et `metriques.json`) ;
- `metriques.json` seul, pour relire les chiffres ;
- la **date du dernier export** et le **nombre de lignes** de chaque jeu (les métriques sont datées par là) ;
- toute erreur de la cellule 4 (valeurs absentes) ou de la cellule 5.

Ne renvoyez pas `export.json` : il contient les identifiants de commandes et de clients.

## Format recommandé

- **JSON** (un seul fichier) pour l'export : le backend le produit déjà et Colab le lit sans conversion.
- Passer à **Parquet** seulement si l'export dépasse environ 100 Mo ; le script l'acceptera alors sans autre changement
  (à demander).
- Les **`.pkl`** (scikit-learn) doivent être chargés avec la même version de scikit-learn que Colab
  (`>=1.5` ici) ; les modèles sont donc renvoyés avec `metriques.json` qui indique la version utilisée.

## Vérifier avant d'entraîner

- Au moins **60 lignes** de demande pour un modèle GBR, sinon la prévision retombe sur des moyennes (le modèle le dit).
- Au moins **40 prospects dont les deux classes** (converti / non converti) pour le score logistique.
- Au moins **30 échantillons** ETA avec préparation et trajet réels.

## Limites connues

- Le jeu de démonstration ne mesure pas la qualité réelle : seules les données de production comptent.
- Les modèles de prospection apprennent à partir des commerces déjà contactés ; un biais de sélection est possible.
- Aucun numéro de téléphone, aucune adresse de client ne doit figurer dans les exports (vérifié par le backend).
