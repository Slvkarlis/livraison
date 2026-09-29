-- Nettoyage de la base "livraison" apres la reduction au perimetre du sprint 1.
-- spring.jpa.hibernate.ddl-auto=update ajoute des colonnes mais n'en supprime jamais :
-- les anciennes colonnes NOT NULL sans valeur par defaut feraient echouer les INSERT.
-- Les comptes utilisateurs (utilisateur, client, responsable) ne sont pas touches.
USE livraison;

-- Tables qui ne font plus partie du sprint 1
DROP TABLE IF EXISTS offre_livraison, position_gps, demande_retour, encaissementcod,
    historique_statut, incident, preuve_livraison, zone;

-- Livraison : on ne garde que adresse + GPS + creneau + paiement + statut
SET @fks = (SELECT GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', constraint_name, '`'))
            FROM information_schema.key_column_usage
            WHERE table_schema = 'livraison' AND table_name = 'livraison'
              AND column_name IN ('livreur_id', 'responsable_id', 'vehicule_id')
              AND referenced_table_name IS NOT NULL);
SET @sql = IF(@fks IS NULL, 'SELECT 1', CONCAT('ALTER TABLE livraison ', @fks));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE livraison
    DROP COLUMN code_otp, DROP COLUMN otp_expire_le, DROP COLUMN otp_utilise,
    DROP COLUMN livreur_id, DROP COLUMN responsable_id, DROP COLUMN vehicule_id,
    DROP COLUMN adresse_depart, DROP COLUMN latitude_depart, DROP COLUMN longitude_depart,
    DROP COLUMN distance_km, DROP COLUMN frais_trajet, DROP COLUMN cout_carburant,
    DROP COLUMN distance_approche_km, DROP COLUMN remuneration_livreur, DROP COLUMN commission_plateforme;

-- Livreur : plus de suivi GPS / statut au sprint 1
ALTER TABLE livreur
    DROP COLUMN statut, DROP COLUMN suivi_gps_actif, DROP COLUMN latitude_gps,
    DROP COLUMN longitude_gps, DROP COLUMN derniere_maj_gps;
