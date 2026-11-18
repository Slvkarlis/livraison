-- Sprint 6, MySQL 8.0.16+ (8.4 recommandé), base existante Sprint 5.
-- Additif et rejouable : aucune donnée ni table existante supprimée.
-- Hibernate ddl-auto=update crée également ces tables/index ; ce script permet une préparation explicite.
CREATE TABLE IF NOT EXISTS notation (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    note INT NOT NULL,
    commentaire VARCHAR(500),
    auteur_id BIGINT NOT NULL,
    cible_id BIGINT NOT NULL,
    commande_id BIGINT NOT NULL,
    date DATETIME(6) NOT NULL,
    CONSTRAINT uk_notation_participant UNIQUE (commande_id, auteur_id, cible_id),
    CONSTRAINT ck_notation_note CHECK (note BETWEEN 1 AND 5),
    CONSTRAINT fk_s6_notation_auteur FOREIGN KEY (auteur_id) REFERENCES utilisateur(id),
    CONSTRAINT fk_s6_notation_cible FOREIGN KEY (cible_id) REFERENCES utilisateur(id),
    CONSTRAINT fk_s6_notation_commande FOREIGN KEY (commande_id) REFERENCES livraison(id),
    INDEX idx_notation_cible_date (cible_id, date)
);
CREATE TABLE IF NOT EXISTS seuil_alerte (
    type VARCHAR(40) NOT NULL PRIMARY KEY,
    valeur DECIMAL(14,3) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alerte (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(40) NOT NULL,
    objet_id BIGINT NOT NULL,
    active BOOLEAN NOT NULL,
    valeur DECIMAL(14,3) NOT NULL,
    seuil DECIMAL(14,3) NOT NULL,
    declenchee_le DATETIME(6) NOT NULL,
    observee_le DATETIME(6) NOT NULL,
    resolue_le DATETIME(6),
    CONSTRAINT uk_alerte_objet UNIQUE (type, objet_id),
    INDEX idx_alerte_active (type, active)
);
INSERT IGNORE INTO seuil_alerte(type, valeur, actif, version) VALUES
 ('CASH_COURSIER',500.000,TRUE,0),
 ('TAUX_REFUS_PARTENAIRE',30.000,TRUE,0),
 ('RETARD_ETA',10.000,TRUE,0),
 ('COUVERTURE_ZONE',50.000,TRUE,0),
 ('ABSENCE_COURSIER',15.000,TRUE,0);

-- MySQL ne propose pas CREATE INDEX IF NOT EXISTS. Cette procédure temporaire ne remplace aucun index existant.
DROP PROCEDURE IF EXISTS sprint6_ajouter_index;
DELIMITER //
CREATE PROCEDURE sprint6_ajouter_index(IN table_cible VARCHAR(64), IN nom_index VARCHAR(64), IN colonnes VARCHAR(200))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = table_cible AND index_name = nom_index) THEN
        SET @sprint6_ddl = CONCAT('CREATE INDEX ', nom_index, ' ON ', table_cible, ' (', colonnes, ')');
        PREPARE sprint6_stmt FROM @sprint6_ddl;
        EXECUTE sprint6_stmt;
        DEALLOCATE PREPARE sprint6_stmt;
    END IF;
END//
DELIMITER ;
CALL sprint6_ajouter_index('livraison','idx_bi_commande_creation','date_creation');
CALL sprint6_ajouter_index('livraison','idx_bi_commande_partenaire','partenaire_id,date_creation');
CALL sprint6_ajouter_index('livraison','idx_bi_commande_livree','livree_le');
CALL sprint6_ajouter_index('livraison','idx_bi_commande_coursier','livreur_id,livree_le');
CALL sprint6_ajouter_index('finance_commande','idx_bi_finance_zone','zone_id,livree_le');
CALL sprint6_ajouter_index('finance_commande','idx_bi_finance_partenaire','partenaire_id,livree_le');
CALL sprint6_ajouter_index('notation','idx_notation_cible_date','cible_id,date');
CALL sprint6_ajouter_index('alerte','idx_alerte_active','type,active');
DROP PROCEDURE sprint6_ajouter_index;
