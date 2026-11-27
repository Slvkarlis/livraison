-- Sprint 9, MySQL 8 : migration additive à appliquer une seule fois, avant le démarrage
-- si ddl-auto=validate/none. Ne pas exécuter sur une base déjà migrée par Hibernate update.
ALTER TABLE client ADD recevoir_invitations_quartier BOOLEAN DEFAULT TRUE;
ALTER TABLE partenaire ADD groupes_quartier_actifs BOOLEAN DEFAULT FALSE;
CREATE TABLE configuration_quartier (id BIGINT PRIMARY KEY, valeur VARCHAR(2000) NOT NULL);
CREATE TABLE groupe_quartier (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    commerce_id BIGINT NOT NULL, zone_id BIGINT NOT NULL, lot_id BIGINT UNIQUE,
    latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, rayon_metres DOUBLE NOT NULL,
    ouverture DATETIME(6) NOT NULL, expiration DATETIME(6) NOT NULL, fermeture DATETIME(6),
    statut VARCHAR(20) NOT NULL, gain_km DOUBLE NOT NULL DEFAULT 0, gain_dt DECIMAL(14,3) DEFAULT 0,
    reduction_deux DECIMAL(6,4), reduction_trois DECIMAL(6,4),
    INDEX idx_quartier_commerce_statut (commerce_id, statut, expiration),
    FOREIGN KEY (commerce_id) REFERENCES partenaire(id), FOREIGN KEY (zone_id) REFERENCES zone(id),
    FOREIGN KEY (lot_id) REFERENCES lot(id)
);
CREATE TABLE invitation_quartier (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, client_id BIGINT NOT NULL, groupe_id BIGINT NOT NULL,
    envoyee_le DATETIME(6), UNIQUE (client_id, groupe_id), INDEX idx_invitation_jour (client_id, envoyee_le),
    FOREIGN KEY (client_id) REFERENCES client(id), FOREIGN KEY (groupe_id) REFERENCES groupe_quartier(id)
);
ALTER TABLE livraison
    ADD groupe_quartier_id BIGINT,
    ADD frais_normaux_quartier DECIMAL(14,3), ADD frais_annonces_quartier DECIMAL(14,3), ADD frais_finaux_quartier DECIMAL(14,3),
    ADD quartier_seule BOOLEAN NOT NULL DEFAULT FALSE, ADD voisins_quartier INT NOT NULL DEFAULT 0,
    ADD session_carte VARCHAR(255), ADD url_paiement_carte VARCHAR(2048), ADD montant_autorise_carte DECIMAL(14,3),
    ADD carte_annulee BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT fk_commande_quartier FOREIGN KEY (groupe_quartier_id) REFERENCES groupe_quartier(id);
