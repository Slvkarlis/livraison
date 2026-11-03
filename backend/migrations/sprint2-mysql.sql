-- Migration additive MySQL 8, à appliquer après sauvegarde, backend arrêté.
-- Option déploiement contrôlé : exécuter ceci puis démarrer avec ddl-auto=validate.
-- En développement, ddl-auto=update produit le même schéma ; ne pas appliquer les deux simultanément.
-- Les anciennes commandes gardent partenaire/total/articles/clé NULL et aucune ligne.
CREATE TABLE IF NOT EXISTS zone (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, nom VARCHAR(100) NOT NULL,
 polygone TEXT NOT NULL, frais_livraison DECIMAL(14,3) NOT NULL,
 min_latitude DOUBLE NOT NULL, max_latitude DOUBLE NOT NULL, min_longitude DOUBLE NOT NULL, max_longitude DOUBLE NOT NULL,
 INDEX idx_zone_enveloppe(min_longitude,max_longitude,min_latitude,max_latitude)
);
-- Procédure temporaire permettant de reprendre une migration partiellement appliquée.
DELIMITER //
DROP PROCEDURE IF EXISTS sprint2_colonne//
CREATE PROCEDURE sprint2_colonne(IN table_nom VARCHAR(64), IN colonne_nom VARCHAR(64), IN definition_sql TEXT)
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=table_nom AND column_name=colonne_nom) THEN
  SET @sprint2_sql=CONCAT('ALTER TABLE `',table_nom,'` ADD COLUMN `',colonne_nom,'` ',definition_sql);
  PREPARE sprint2_stmt FROM @sprint2_sql; EXECUTE sprint2_stmt; DEALLOCATE PREPARE sprint2_stmt;
 END IF;
END//
DELIMITER ;
CALL sprint2_colonne('partenaire','zone_id','BIGINT NULL');
CALL sprint2_colonne('partenaire','ouvert','BIT NULL DEFAULT 0');
CALL sprint2_colonne('livraison','partenaire_id','BIGINT NULL');
CALL sprint2_colonne('livraison','nom_partenaire','VARCHAR(255) NULL');
CALL sprint2_colonne('livraison','nom_zone','VARCHAR(255) NULL');
CALL sprint2_colonne('livraison','montant_articles','DECIMAL(14,3) NULL');
CALL sprint2_colonne('livraison','total','DECIMAL(14,3) NULL');
CALL sprint2_colonne('livraison','notes','VARCHAR(500) NULL');
CALL sprint2_colonne('livraison','cle_idempotence','VARCHAR(180) NULL UNIQUE');
CALL sprint2_colonne('livraison','empreinte_requete','VARCHAR(255) NULL');
DROP PROCEDURE sprint2_colonne;
DELIMITER //
DROP PROCEDURE IF EXISTS sprint2_fk//
CREATE PROCEDURE sprint2_fk(IN table_nom VARCHAR(64), IN contrainte_nom VARCHAR(64), IN definition_sql TEXT)
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=table_nom AND constraint_name=contrainte_nom) THEN
  SET @sprint2_sql=CONCAT('ALTER TABLE `',table_nom,'` ADD CONSTRAINT `',contrainte_nom,'` ',definition_sql);
  PREPARE sprint2_stmt FROM @sprint2_sql; EXECUTE sprint2_stmt; DEALLOCATE PREPARE sprint2_stmt;
 END IF;
END//
DELIMITER ;
CALL sprint2_fk('partenaire','fk_sprint2_partenaire_zone','FOREIGN KEY (zone_id) REFERENCES zone(id)');
CALL sprint2_fk('livraison','fk_sprint2_livraison_partenaire','FOREIGN KEY (partenaire_id) REFERENCES partenaire(id)');
DROP PROCEDURE sprint2_fk;
-- Conversion ENUM -> VARCHAR sans perte des libellés existants.
ALTER TABLE livraison MODIFY COLUMN statut VARCHAR(30) NULL;
CREATE TABLE IF NOT EXISTS produit (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, partenaire_id BIGINT NOT NULL,
 nom VARCHAR(120) NOT NULL, prix DECIMAL(14,3) NOT NULL, disponible BIT NOT NULL,
 FOREIGN KEY (partenaire_id) REFERENCES partenaire(id)
);
CREATE TABLE IF NOT EXISTS adresse_livraison (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, client_id BIGINT NOT NULL,
 libelle VARCHAR(80) NOT NULL, adresse VARCHAR(250) NOT NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
 FOREIGN KEY (client_id) REFERENCES client(id)
);
CREATE TABLE IF NOT EXISTS ligne_commande (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, commande_id BIGINT NOT NULL, produit_id BIGINT NOT NULL,
 nom_produit VARCHAR(120) NOT NULL, quantite INT NOT NULL, prix_unitaire DECIMAL(14,3) NOT NULL, sous_total DECIMAL(14,3) NOT NULL,
 FOREIGN KEY (commande_id) REFERENCES livraison(id), FOREIGN KEY (produit_id) REFERENCES produit(id)
);
-- Vérifier : aucune baisse de COUNT(*) sur livraison ; anciennes lignes inchangées ; nouvelles tables vides hors données ajoutées.
-- Retour applicatif : conserver les colonnes/tables additives ; ne jamais supprimer l'historique pour revenir au Sprint 1.
