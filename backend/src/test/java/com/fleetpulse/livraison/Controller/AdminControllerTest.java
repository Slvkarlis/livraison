package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Service.AdminService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

/** TP 5 : toutes les opérations CRUD du véhicule, leurs statuts HTTP et les cas absents. */
@ExtendWith(MockitoExtension.class)
class AdminControllerTest extends ControleurTestSupport {
    @Mock AdminService service;
    @InjectMocks AdminController controleur;
    MockMvc http;
    final String vehiculeJson = "{\"immatriculation\":\"123 TU 456\",\"type\":\"Scooter\",\"capaciteKg\":30,\"consommationLitres100Km\":3}";
    @BeforeEach void preparer() { http = http(controleur); }

    @Test void creerVehiculeRetourne201EtLeCorps() throws Exception {
        when(service.createVehicule(any())).thenReturn(VehiculeResponse.from(vehicule()));
        http.perform(post("/api/admin/vehicules").contentType("application/json").content(vehiculeJson))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.immatriculation").value("123 TU 456"));
        verify(service).createVehicule(new CreateVehiculeRequest("123 TU 456", "Scooter", 30., 3.));
    }

    @Test void listerVehiculesEtListeVide() throws Exception {
        when(service.listVehicules()).thenReturn(List.of(VehiculeResponse.from(vehicule())), List.of());
        http.perform(get("/api/admin/vehicules")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(5));
        http.perform(get("/api/admin/vehicules")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test void lireVehiculeExistantEtAbsent() throws Exception {
        when(service.findVehicule(5L)).thenReturn(Optional.of(VehiculeResponse.from(vehicule())));
        when(service.findVehicule(99L)).thenReturn(Optional.empty());
        http.perform(get("/api/admin/vehicules/5")).andExpect(status().isOk()).andExpect(jsonPath("$.actif").value(true));
        http.perform(get("/api/admin/vehicules/99")).andExpect(status().isNotFound());
    }

    @Test void modifierVehiculeExistantEtAbsent() throws Exception {
        when(service.updateVehicule(eq(5L), any())).thenReturn(Optional.of(VehiculeResponse.from(vehicule())));
        when(service.updateVehicule(eq(99L), any())).thenReturn(Optional.empty());
        http.perform(put("/api/admin/vehicules/5").contentType("application/json").content(vehiculeJson))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(5));
        http.perform(put("/api/admin/vehicules/99").contentType("application/json").content(vehiculeJson)).andExpect(status().isNotFound());
    }

    @Test void supprimerVehiculeInvoqueServiceEtRetourne204Ou404() throws Exception {
        when(service.deactivateVehicule(5L)).thenReturn(true);
        http.perform(delete("/api/admin/vehicules/5")).andExpect(status().isNoContent()).andExpect(content().string(""));
        verify(service).deactivateVehicule(5L);
        http.perform(delete("/api/admin/vehicules/99")).andExpect(status().isNotFound());
    }

    @Test void donneesInvalidesDoublonEtJsonIllisible() throws Exception {
        when(service.createVehicule(any())).thenThrow(new IllegalArgumentException(), new AdminService.DuplicateDataException());
        http.perform(post("/api/admin/vehicules").contentType("application/json").content(vehiculeJson)).andExpect(status().isBadRequest());
        http.perform(post("/api/admin/vehicules").contentType("application/json").content(vehiculeJson)).andExpect(status().isConflict());
        http.perform(post("/api/admin/vehicules").contentType("application/json").content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("DONNEES_INVALIDES"));
    }

    @Test void reactivationVehicule() throws Exception {
        when(service.activateVehicule(5L)).thenReturn(true);
        http.perform(put("/api/admin/vehicules/5/activer")).andExpect(status().isNoContent());
        http.perform(put("/api/admin/vehicules/99/activer")).andExpect(status().isNotFound());
    }

    @Test void listerEtCreerLivreur() throws Exception {
        when(service.listLivreurs()).thenReturn(List.of(LivreurResponse.from(livreur())));
        when(service.createLivreur(any())).thenReturn(LivreurResponse.from(livreur()));
        http.perform(get("/api/admin/livreurs")).andExpect(jsonPath("$[0].prenom").value("Sami"));
        http.perform(post("/api/admin/livreurs").contentType("application/json").content("{\"nom\":\"Livreur\",\"prenom\":\"Sami\",\"email\":\"livreur@test.tn\",\"motDePasse\":\"test-password\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(4));
    }

    @Test void modifierLivreurExistantOuAbsent() throws Exception {
        when(service.updateLivreur(eq(4L), any())).thenReturn(Optional.of(LivreurResponse.from(livreur())));
        http.perform(put("/api/admin/livreurs/4").contentType("application/json").content("{\"prenom\":\"Sami\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.prenom").value("Sami"));
        http.perform(put("/api/admin/livreurs/99").contentType("application/json").content("{}")).andExpect(status().isNotFound());
    }

    @Test void activationEtDesactivationLivreur() throws Exception {
        when(service.deactivateLivreur(4L)).thenReturn(true); when(service.activateLivreur(4L)).thenReturn(true);
        http.perform(delete("/api/admin/livreurs/4")).andExpect(status().isNoContent());
        http.perform(delete("/api/admin/livreurs/99")).andExpect(status().isNotFound());
        http.perform(put("/api/admin/livreurs/4/activer")).andExpect(status().isNoContent());
        http.perform(put("/api/admin/livreurs/99/activer")).andExpect(status().isNotFound());
    }

    @Test void affectationEtRetraitVehicule() throws Exception {
        when(service.assignVehicule(eq(4L), any())).thenReturn(Optional.of(LivreurResponse.from(livreur())));
        when(service.unassignVehicule(4L)).thenReturn(true);
        http.perform(put("/api/admin/livreurs/4/vehicule").contentType("application/json").content("{\"vehiculeId\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(4));
        verify(service).assignVehicule(4L, new AssignVehiculeRequest(5L));
        http.perform(put("/api/admin/livreurs/99/vehicule").contentType("application/json").content("{\"vehiculeId\":5}")).andExpect(status().isNotFound());
        http.perform(delete("/api/admin/livreurs/4/vehicule")).andExpect(status().isNoContent());
        http.perform(delete("/api/admin/livreurs/99/vehicule")).andExpect(status().isNotFound());
    }
    @Test void erreursDeCreationLivreurEtAffectationInvalide() throws Exception {
        when(service.createLivreur(any())).thenThrow(new IllegalArgumentException(),new AdminService.DuplicateDataException());
        String json="{\"nom\":\"Livreur\",\"prenom\":\"Sami\",\"email\":\"livreur@test.tn\",\"motDePasse\":\"test-password\"}";
        http.perform(post("/api/admin/livreurs").contentType("application/json").content(json)).andExpect(status().isBadRequest());
        http.perform(post("/api/admin/livreurs").contentType("application/json").content(json)).andExpect(status().isConflict());
        when(service.assignVehicule(eq(4L),any())).thenThrow(new IllegalArgumentException());
        http.perform(put("/api/admin/livreurs/4/vehicule").contentType("application/json").content("{}")).andExpect(status().isBadRequest());
    }
}
