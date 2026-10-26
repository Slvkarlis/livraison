package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Service.Telephones;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByEmail(String email);

    boolean existsByEmail(String email);

    // findFirst : les anciens comptes peuvent partager un numero (pas de contrainte unique en base)
    Optional<Utilisateur> findFirstByTelephone(String telephone);

    boolean existsByTelephone(String telephone);

    List<Utilisateur> findAllByOrderByNomAscPrenomAsc();

    List<Utilisateur> findAllByStatutInOrderByDateCreationAsc(Collection<StatutCompte> statuts);

    /** Email (contient "@") ou numero de telephone. */
    default Optional<Utilisateur> findByIdentifiant(String identifiant) {
        if (identifiant == null || identifiant.isBlank()) return Optional.empty();
        String valeur = identifiant.trim();
        return valeur.contains("@")
                ? findByEmail(valeur.toLowerCase())
                : findFirstByTelephone(Telephones.normaliser(valeur));
    }
}
