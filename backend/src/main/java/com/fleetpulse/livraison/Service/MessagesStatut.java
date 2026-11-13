package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * US-304 : texte de la notification envoyee au client a chaque changement de statut.
 * Memes formulations que l'application (messageDecisionClient) pour que le bandeau, la boite et le push concordent.
 */
public final class MessagesStatut {
    /** Heures affichees a l'heure de Tunisie, quel que soit le fuseau du serveur. */
    static final ZoneId FUSEAU = ZoneId.of("Africa/Tunis");
    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm").withZone(FUSEAU);

    public record Message(String titre, String texte) { }

    private MessagesStatut() { }

    /** Vide : pas de notification (commande que le client vient lui-meme de passer). */
    public static Optional<Message> pourClient(Livraison c, StatutLivraison nouveau) {
        String commerce = c.getPartenaire() != null && c.getPartenaire().getNomCommerce() != null ? c.getPartenaire().getNomCommerce() : "Le commerce";
        String livreur = c.getLivreur() != null ? c.getLivreur().getPrenom() : null;
        String prete = c.heurePretePrevue() == null ? null : HEURE.format(c.heurePretePrevue());
        String code = " · " + c.getCodeSuivi();
        return Optional.ofNullable(switch (nouveau) {
            case ACCEPTEE -> new Message("Commande acceptée" + code,
                    prete == null ? commerce + " a accepté votre commande." : commerce + " a accepté : prête vers " + prete + ".");
            case EN_PREPARATION -> new Message("En préparation" + code,
                    prete == null ? commerce + " prépare votre commande." : commerce + " prépare votre commande : prête vers " + prete + ".");
            case PRETE -> new Message("Commande prête" + code, commerce + " : votre commande est prête. Un livreur va la récupérer.");
            case AFFECTEE -> new Message("Livreur en route vers le commerce" + code,
                    commerce + " : " + (livreur == null ? "un livreur" : livreur) + " va récupérer votre commande.");
            case RECUPEREE -> new Message("Commande en route" + code,
                    (livreur == null ? "Le livreur" : livreur) + " a récupéré votre commande. Elle est en route vers vous.");
            case A_PROXIMITE -> new Message("Le livreur arrive" + code,
                    (livreur == null ? "Le livreur" : livreur) + " arrive : il est à moins de 300 m. Préparez votre QR de remise.");
            case LIVREE -> new Message("Commande livrée" + code, "Votre commande a été remise. Merci d'avoir commandé chez " + commerce + " !");
            case REFUSEE -> new Message("Commande refusée" + code, commerce + " a refusé : "
                    + (c.getMotifRefus() == null ? "sans motif" : c.getMotifRefus().libelle())
                    + (c.getCommentaireRefus() == null || c.getCommentaireRefus().isBlank() ? "" : " — " + c.getCommentaireRefus())
                    + ". Aucun montant ne vous sera demandé.");
            // Le client n'est pas notifie de sa propre annulation : ici, annulation par le service client (US-311)
            case ANNULEE -> new Message("Commande annulée" + code, "Votre commande a été annulée par notre service client"
                    + (c.getMotifAnnulation() == null || c.getMotifAnnulation().isBlank() ? "" : " : " + c.getMotifAnnulation())
                    + ". Aucun montant ne vous sera demandé.");
            default -> null;
        });
    }
}
