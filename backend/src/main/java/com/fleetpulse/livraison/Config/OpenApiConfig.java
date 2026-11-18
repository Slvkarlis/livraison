package com.fleetpulse.livraison.Config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.util.Map;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI livraisonOpenApi() {
        return new OpenAPI()
                .info(new Info().title("FleetPulse - API Livraison").version("sprint-6")
                        .description("API full-stack des sprints 1 à 6. Parcours : catalogue → devis → commande COD → préparation → lot et offre au livreur → collecte → remise → dépôt du cash → closing hebdomadaire → notation et tableaux de bord BI. "
                                + "Montants en dinars tunisiens (DT), trois décimales maximum ; coordonnées WGS84 dans l’ordre latitude, longitude. "
                                + "Utiliser le token retourné par /api/auth/login dans Authorize, sans le préfixe Bearer."))
                .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    @Bean
    OpenApiCustomizer authentificationPublique() {
        return api -> api.getPaths().forEach((path, item) -> {
            if (path.startsWith("/api/auth/")) {
                item.readOperations().forEach(operation -> operation.setSecurity(List.of()));
            }
        });
    }

    /** Centralise les erreurs communes sans remplacer les schémas de réussite inférés par Springdoc. */
    @Bean
    OpenApiCustomizer documentationMetier() {
        return api -> {
            api.getComponents().addSchemas("ErreurResponse", new ObjectSchema()
                    .addProperty("code", new StringSchema().description("Code applicatif stable").example("DONNEES_INVALIDES"))
                    .addProperty("message", new StringSchema().description("Explication affichable par l’interface").example("Position géographique invalide.")));
            api.getPaths().forEach((path, item) -> {
                if (path.startsWith("/api/auth/")) return;
                item.readOperationsMap().forEach((method, operation) -> {
                    ApiResponses reponses = operation.getResponses();
                    if (reponses == null) { reponses = new ApiResponses(); operation.setResponses(reponses); }
                    // Le filtre JWT répond sans corps pour un jeton absent ou invalide.
                    reponses.addApiResponse("401", new ApiResponse().description("Jeton absent, invalide ou expiré.").content(new Content()));
                    reponses.addApiResponse("403", erreur("Rôle insuffisant ou accès à la ressource interdit.", "ACCES_REFUSE"));
                    reponses.addApiResponse("500", erreur("Erreur interne ; les détails techniques ne sont pas exposés au client.", "ERREUR_INTERNE"));
                    if (operation.getRequestBody() != null || operation.getParameters() != null && !operation.getParameters().isEmpty())
                        reponses.addApiResponse("400", erreur("Données, paramètres ou JSON invalides. Certaines routes de flotte renvoient un corps vide.", "DONNEES_INVALIDES"));
                    if (path.contains("{") || path.equals("/api/me") || path.equals("/api/dossier")) {
                        boolean flotte = path.matches("/api/admin/(livreurs|vehicules)/\\{[^/]+\\}(?:/activer|/vehicule)?");
                        reponses.addApiResponse("404", flotte
                                ? new ApiResponse().description("Ressource introuvable.").content(new Content())
                                : erreur("Ressource introuvable ou masquée pour cet utilisateur.", "INTROUVABLE"));
                    }
                    boolean modification = method != io.swagger.v3.oas.models.PathItem.HttpMethod.GET;
                    if (modification && path.matches("/api/admin/(livreurs|vehicules)"))
                        reponses.addApiResponse("409", new ApiResponse().description("Email ou immatriculation déjà utilisés ; réponse sans corps.").content(new Content()));
                    if (modification && (path.contains("/commandes") || path.contains("/zones")
                            || path.contains("/dossier") || path.contains("/comptes") || path.equals("/api/admin/responsables")
                            || path.equals("/api/partenaire/commerce") || path.endsWith("/disponibilite")
                            || path.endsWith("/missions/{id}/collecte") || path.endsWith("/missions/{id}/remise")
                            || path.startsWith("/api/livreur/offres/") || path.startsWith("/api/admin/dispatch/")
                            || path.startsWith("/api/admin/finance/")))
                        reponses.addApiResponse("409", erreur("État métier incompatible, doublon ou limite atteinte.", "ETAT_INVALIDE"));
                    if (path.equals("/api/commandes") || path.endsWith("/code-remise"))
                        reponses.addApiResponse("429", erreur("Délai entre deux demandes ou nombre d’envois dépassé.", "TROP_DE_DEMANDES"));
                    if (path.endsWith("/code-remise"))
                        reponses.addApiResponse("503", erreur("Passerelle SMS/email non configurée ou indisponible.", "SERVICE_INDISPONIBLE"));
                    if (operation.getParameters() != null) operation.getParameters().forEach(parametre -> {
                        boolean periodeBi = (path.contains("/bi") || path.equals("/api/partenaire/ventes"))
                                && ("debut".equals(parametre.getName()) || "fin".equals(parametre.getName()));
                        if (periodeBi) parametre.setDescription("Date civile YYYY-MM-DD incluse, fuseau Africa/Tunis ; 366 jours maximum. Par défaut : les 30 derniers jours.");
                        else if (parametre.getDescription() == null) parametre.setDescription(descriptionParametre(parametre.getName()));
                        if ("path".equals(parametre.getIn())) parametre.setExample(1);
                    });
                });
            });
        };
    }

    private static ApiResponse erreur(String description, String code) {
        return new ApiResponse().description(description).content(new Content().addMediaType("application/json",
                new MediaType().schema(new Schema<>().$ref("#/components/schemas/ErreurResponse"))
                        .example(Map.of("code", code, "message", description))));
    }

    private static String descriptionParametre(String nom) {
        return switch (nom) {
            case "id", "livreurId", "affectationId" -> "Identifiant de la ressource concernée.";
            case "adresseId" -> "Identifiant d’une adresse appartenant au client connecté ; détermine la zone desservie.";
            case "page" -> "Numéro de page, à partir de 0.";
            case "taille" -> "Nombre d’éléments par page, entre 1 et 100.";
            case "debut", "fin" -> "Date ISO 8601, par exemple 2026-11-17T08:00:00Z ; début inclus, fin exclue.";
            case "statut", "role", "action" -> "Filtre facultatif parmi les valeurs de l’énumération affichées.";
            case "recherche" -> "Recherche facultative dans le nom du commerce, sans distinction de casse.";
            case "categorie" -> "Catégorie du commerce, sans distinction de casse.";
            case "limite" -> "Nombre maximal de résultats ; défaut 200, plafond selon la route.";
            case "acteur" -> "Email de l’auteur de l’événement d’audit.";
            case "depuis" -> "Date ISO 8601 de début, incluse ; par défaut depuis le début de l’historique.";
            case "type" -> "Type facultatif parmi les valeurs de l’énumération affichées.";
            case "semaine" -> "Un jour de la semaine visée, au format 2026-11-16 ; ramené au lundi (heure de Tunisie).";
            case "commandeId", "partenaireId" -> "Identifiant de filtre facultatif.";
            case "cibleId" -> "Identifiant du compte ou de la ressource visée par l’événement.";
            default -> "Paramètre " + nom + ".";
        };
    }
}
