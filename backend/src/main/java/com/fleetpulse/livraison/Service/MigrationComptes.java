package com.fleetpulse.livraison.Service;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migration unique des comptes existants, executee au demarrage (sans effet une fois faite).
 * ddl-auto=update ajoute la colonne "statut" mais ne modifie ni ne supprime jamais une colonne existante :
 * - l'ancien booleen utilisateur.actif (NOT NULL) ferait echouer les INSERT, il est converti en statut puis supprime ;
 * - utilisateur.role etait un ENUM MySQL sans PARTENAIRE, il passe en varchar.
 */
@Component
@Order(0)
public class MigrationComptes implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(MigrationComptes.class);

    @Autowired
    private JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        if (typeColonne("utilisateur", "actif") != null) {
            jdbc.update("UPDATE utilisateur SET statut = CASE WHEN actif THEN 'ACTIF' ELSE 'SUSPENDU' END");
            jdbc.execute("ALTER TABLE utilisateur DROP COLUMN actif");
            log.info("Migration : utilisateur.actif converti en utilisateur.statut");
        }
        if ("enum".equalsIgnoreCase(typeColonne("utilisateur", "role"))) {
            jdbc.execute("ALTER TABLE utilisateur MODIFY role varchar(20) NOT NULL");
            log.info("Migration : utilisateur.role passe en varchar(20)");
        }
    }

    private String typeColonne(String table, String colonne) {
        List<String> types = jdbc.queryForList(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                String.class, table, colonne);
        return types.isEmpty() ? null : types.get(0);
    }
}
